const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const { router: authRoutes, setDiscordClient } = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { requireAuth } = require('./middleware/auth');

function createWebServer(discordClient) {
  if (discordClient) {
    setDiscordClient(discordClient);
  }

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https://images.pexels.com"],
      },
    },
  }));

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 4,
      sameSite: 'lax',
    },
  }));

  app.use('/auth', authRoutes);
  app.use('/api', requireAuth, apiRoutes);

  app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });

  app.get('/history', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
  });

  app.get('/settings', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
  });

  app.use(express.static(path.join(__dirname, 'public')));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Panel web accessible sur le port ${PORT}`);
  });

  return app;
}

module.exports = { createWebServer };
