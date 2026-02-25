const rateLimit = require('express-rate-limit');

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives. Reessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Reessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ error: 'Non autorise' });
  }
  return res.redirect('/login');
}

function isAuthorizedDiscordId(discordId) {
  const adminIds = process.env.ADMIN_DISCORD_ID;

  if (!adminIds) {
    console.error('ADMIN_DISCORD_ID non defini dans .env');
    return false;
  }

  const adminsList = adminIds.split(',').map(id => id.trim());

  return adminsList.includes(discordId.trim());
}

module.exports = {
  requireAuth,
  codeLimiter,
  verifyLimiter,
  isAuthorizedDiscordId
};