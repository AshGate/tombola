const { EmbedBuilder } = require('discord.js');
const supabase = require('./supabase');
const { GAIN_EMPLOYE_PAR_TICKET, GAIN_ENTREPRISE_PAR_TICKET } = require('./constants');

async function getLogsChannelId(guildId) {
  const { data } = await supabase
    .from('bot_config')
    .select('logs_channel_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  return data?.logs_channel_id ?? null;
}

async function setLogsChannelId(guildId, channelId) {
  const { error } = await supabase
    .from('bot_config')
    .upsert({ guild_id: guildId, logs_channel_id: channelId, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });

  return !error;
}

async function sendSaleLog(client, guildId, { sellerDisplayName, sellerMention, nom, prenom, numero, quantite, gain_employe, gain_entreprise }) {
  const channelId = await getLogsChannelId(guildId);
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('Nouvelle vente enregistree')
    .setColor('#00B86B')
    .addFields(
      { name: 'Vendeur', value: `${sellerDisplayName} (${sellerMention})`, inline: false },
      { name: 'Client', value: `${prenom} ${nom}`, inline: true },
      { name: 'Telephone', value: numero, inline: true },
      { name: 'Tickets vendus', value: quantite.toString(), inline: true },
      { name: 'Gain employe', value: `${gain_employe.toLocaleString()}$`, inline: true },
      { name: 'Gain entreprise', value: `${gain_entreprise.toLocaleString()}$`, inline: true },
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);
}

async function archiveSales(sales) {
  if (!sales || sales.length === 0) return;

  const rows = sales.map(s => ({
    seller_id: s.seller_id,
    nom: s.nom,
    prenom: s.prenom,
    numero: s.numero,
    quantite: s.quantite,
    gain_employe: s.gain_employe,
    gain_entreprise: s.gain_entreprise,
    created_at: s.created_at,
    archived_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('sales_archive').insert(rows);
  if (error) console.error('Erreur lors de l\'archivage des ventes:', error);
}

async function sendDailyRecap(client) {
  const { data: configs } = await supabase
    .from('bot_config')
    .select('guild_id, logs_channel_id');

  if (!configs || configs.length === 0) return;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const { data: sales, error } = await supabase
    .from('sales')
    .select('seller_id, quantite, gain_employe, gain_entreprise, created_at')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    console.error('Erreur recap quotidien:', error);
    return;
  }

  const { data: archivedSales } = await supabase
    .from('sales_archive')
    .select('seller_id, quantite, gain_employe, gain_entreprise, created_at')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', now.toISOString());

  const allSales = [...(sales ?? []), ...(archivedSales ?? [])];

  const seen = new Set();
  const uniqueSales = allSales.filter(s => {
    const key = `${s.seller_id}-${s.quantite}-${s.created_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueSales.length === 0) {
    for (const config of configs) {
      if (!config.logs_channel_id) continue;
      const channel = client.channels.cache.get(config.logs_channel_id) ?? await client.channels.fetch(config.logs_channel_id).catch(() => null);
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setTitle('Recapitulatif du jour')
        .setColor('#0099FF')
        .setDescription('Aucune vente enregistree aujourd\'hui.')
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(console.error);
    }
    return;
  }

  const totalTickets = uniqueSales.reduce((sum, s) => sum + s.quantite, 0);
  const totalGainEmployes = uniqueSales.reduce((sum, s) => sum + s.gain_employe, 0);
  const totalGainEntreprise = uniqueSales.reduce((sum, s) => sum + s.gain_entreprise, 0);

  const sellerMap = {};
  for (const sale of uniqueSales) {
    if (!sellerMap[sale.seller_id]) {
      sellerMap[sale.seller_id] = 0;
    }
    sellerMap[sale.seller_id] += sale.quantite;
  }

  const sortedSellers = Object.entries(sellerMap).sort((a, b) => b[1] - a[1]);

  for (const config of configs) {
    if (!config.logs_channel_id) continue;

    const channel = client.channels.cache.get(config.logs_channel_id) ?? await client.channels.fetch(config.logs_channel_id).catch(() => null);
    if (!channel) continue;

    const guild = channel.guild;
    const sellerLines = [];

    for (const [sellerId, tickets] of sortedSellers) {
      const member = guild?.members.cache.get(sellerId)
        ?? await guild?.members.fetch(sellerId).catch(() => null);
      const displayName = member?.displayName ?? `Utilisateur inconnu`;
      sellerLines.push(`**${displayName}** — ${tickets} ticket(s)`);
    }

    const embed = new EmbedBuilder()
      .setTitle('Recapitulatif du jour')
      .setColor('#0099FF')
      .addFields(
        { name: 'Tickets vendus', value: totalTickets.toLocaleString(), inline: true },
        { name: 'Total gains employes', value: `${totalGainEmployes.toLocaleString()}$`, inline: true },
        { name: 'Total gains entreprise', value: `${totalGainEntreprise.toLocaleString()}$`, inline: true },
        { name: 'Vendeurs du jour', value: sellerLines.join('\n') || 'Aucun', inline: false },
      )
      .setFooter({ text: `Recapitulatif automatique — ${now.toLocaleDateString('fr-FR')}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(console.error);
  }
}

function scheduleDailyRecap(client) {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(17, 0, 0, 0);

    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    setTimeout(async () => {
      await sendDailyRecap(client).catch(console.error);
      scheduleNext();
    }, delay);

    const hours = Math.floor(delay / 3600000);
    const mins = Math.floor((delay % 3600000) / 60000);
    console.log(`Prochain recapitulatif dans ${hours}h${mins}m`);
  };

  scheduleNext();
}

module.exports = { getLogsChannelId, setLogsChannelId, sendSaleLog, archiveSales, sendDailyRecap, scheduleDailyRecap };
