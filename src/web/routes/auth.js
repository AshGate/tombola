const { Router } = require('express');
const crypto = require('crypto');
const supabase = require('../../supabase');
const { codeLimiter, verifyLimiter, isAuthorizedDiscordId } = require('../middleware/auth');

let discordClient = null;

function setDiscordClient(client) {
  discordClient = client;
}

const router = Router();

router.post('/request-code', codeLimiter, async (req, res) => {
  try {
    const { discord_id } = req.body || {};

    if (!discord_id || !/^\d{17,20}$/.test(discord_id.trim())) {
      return res.status(400).json({ error: 'ID Discord invalide.' });
    }

    const cleanId = discord_id.trim();

    if (!isAuthorizedDiscordId(cleanId)) {
      return res.status(403).json({ error: 'Cet ID Discord n\'est pas autorise.' });
    }

    if (!discordClient || !discordClient.isReady()) {
      return res.status(503).json({ error: 'Le bot Discord n\'est pas connecte.' });
    }

    await supabase
      .from('auth_codes')
      .delete()
      .eq('discord_id', cleanId);

    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('auth_codes')
      .insert({
        discord_id: cleanId,
        code,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Erreur insertion code:', insertError);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }

    try {
      const user = await discordClient.users.fetch(cleanId);
      await user.send(
        `**Tombola Panel - Code de connexion**\n\nVotre code de verification : **${code}**\n\nCe code expire dans 5 minutes.\nSi vous n'avez pas demande ce code, ignorez ce message.`
      );
    } catch (dmError) {
      console.error('Erreur envoi DM:', dmError);
      await supabase.from('auth_codes').delete().eq('discord_id', cleanId);
      return res.status(400).json({ error: 'Impossible d\'envoyer le message prive. Verifiez que vos DM sont ouverts.' });
    }

    res.json({ success: true, message: 'Code envoye en message prive Discord.' });
  } catch (err) {
    console.error('Erreur request-code:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/verify-code', verifyLimiter, async (req, res) => {
  try {
    const { discord_id, code } = req.body || {};

    if (!discord_id || !code) {
      return res.status(400).json({ error: 'ID Discord et code requis.' });
    }

    const cleanId = discord_id.trim();
    const cleanCode = code.trim();

    if (!isAuthorizedDiscordId(cleanId)) {
      return res.status(403).json({ error: 'Cet ID Discord n\'est pas autorise.' });
    }

    const { data: authCode, error: fetchError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('discord_id', cleanId)
      .eq('used', false)
      .maybeSingle();

    if (fetchError) {
      console.error('Erreur fetch code:', fetchError);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }

    if (!authCode) {
      return res.status(400).json({ error: 'Aucun code en attente. Demandez un nouveau code.' });
    }

    if (new Date(authCode.expires_at) < new Date()) {
      await supabase.from('auth_codes').delete().eq('id', authCode.id);
      return res.status(400).json({ error: 'Code expire. Demandez un nouveau code.' });
    }

    if (authCode.attempts >= 3) {
      await supabase.from('auth_codes').delete().eq('id', authCode.id);
      return res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
    }

    if (authCode.code !== cleanCode) {
      await supabase
        .from('auth_codes')
        .update({ attempts: authCode.attempts + 1 })
        .eq('id', authCode.id);

      const remaining = 2 - authCode.attempts;
      return res.status(401).json({
        error: `Code incorrect. ${remaining > 0 ? remaining + ' tentative(s) restante(s).' : 'Demandez un nouveau code.'}`,
      });
    }

    await supabase.from('auth_codes').delete().eq('id', authCode.id);

    req.session.authenticated = true;
    req.session.discordId = cleanId;

    req.session.save((err) => {
      if (err) {
        console.error('Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Erreur verify-code:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

module.exports = { router, setDiscordClient };
