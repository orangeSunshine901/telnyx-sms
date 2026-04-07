import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import session from 'express-session';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Hash the plaintext password once at startup
const PASSWORD_HASH = bcrypt.hashSync(process.env.AUTH_PASSWORD, 12);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Auth middleware — skip for login page and Telnyx webhook
function requireAuth(req, res, next) {
  const public_paths = ['/login', '/webhooks'];
  if (public_paths.includes(req.path) || req.session.authenticated) return next();
  res.redirect('/login');
}

app.use(requireAuth);
app.use(express.static(join(__dirname, 'public')));

// --- Auth routes ---

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.AUTH_USERNAME;
  const validPass = bcrypt.compareSync(password ?? '', PASSWORD_HASH);

  if (!validUser || !validPass) {
    return res.redirect('/login?error=1');
  }

  req.session.regenerate((err) => {
    if (err) return res.redirect('/login?error=1');
    req.session.authenticated = true;
    res.redirect('/');
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- SMS routes ---

const messages = [];

// Receive inbound SMS from Telnyx
app.post('/webhooks', (req, res) => {
  const { data } = req.body;

  if (data.event_type === 'message.received') {
    const { payload } = data;
    const msg = {
      direction: 'inbound',
      from: payload.from.phone_number,
      to: payload.to[0].phone_number,
      text: payload.text,
      media: payload.media ?? [],
      timestamp: new Date().toISOString(),
    };
    messages.push(msg);
    io.emit('message', msg);
    console.log(`Inbound from ${msg.from}: ${msg.text}`);
  }

  res.sendStatus(200);
});

// Send an outbound SMS via Telnyx
app.post('/send', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' });

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify({ from: process.env.TELNYX_PHONE_NUMBER, to, text }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Telnyx error:', err);
    return res.status(response.status).json(err);
  }

  const msg = {
    direction: 'outbound',
    from: process.env.TELNYX_PHONE_NUMBER,
    to,
    text,
    timestamp: new Date().toISOString(),
  };
  messages.push(msg);
  io.emit('message', msg);

  res.json({ ok: true });
});

// Return full message history
app.get('/messages', (_req, res) => {
  res.json(messages);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`SMS app running on http://localhost:${PORT}`));
