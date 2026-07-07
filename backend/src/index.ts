import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import crypto from 'crypto';
import {
  seedDemoData,
  getUser,
  upsertUser,
  getFriendsForTree,
  getAllUsers,
  createUser,
  deleteUser,
  createRelationship,
  deleteRelationship,
  getRelationshipsForUser,
} from './db.js';
import { importFwendatorData, type FwendatorData } from './import.js';

seedDemoData();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'discord-family-tree-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    oauthState?: string;
  }
}

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord/callback`;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const userId = req.session.userId || 'you';
  const user = getUser(userId);
  res.json({ user, isDemo: !req.session.userId });
});

app.get('/api/tree', (req, res) => {
  const rootId = (req.query.root as string) || req.session.userId || 'you';
  const tree = getFriendsForTree(rootId);
  res.json(tree);
});

app.get('/api/users', (_req, res) => {
  res.json(getAllUsers());
});

app.post('/api/users', (req, res) => {
  const { username, display_name, avatar_url, status, bio } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  const id = crypto.randomUUID();
  const user = createUser({
    id,
    discord_id: null,
    username,
    display_name: display_name || username,
    avatar_url: avatar_url || `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 6)}.png`,
    status: status || 'offline',
    bio: bio || null,
  });
  res.status(201).json(user);
});

app.delete('/api/users/:id', (req, res) => {
  if (req.params.id === 'you') return res.status(403).json({ error: 'Cannot delete root user' });
  deleteUser(req.params.id);
  res.json({ ok: true });
});

app.get('/api/relationships', (req, res) => {
  const userId = (req.query.userId as string) || req.session.userId || 'you';
  res.json(getRelationshipsForUser(userId));
});

app.post('/api/relationships', (req, res) => {
  const userId = req.session.userId || 'you';
  const { from_id, to_id, type, label } = req.body;
  if (!from_id || !to_id || !type) {
    return res.status(400).json({ error: 'from_id, to_id, and type required' });
  }
  const rel = createRelationship({ user_id: userId, from_id, to_id, type, label: label || null });
  res.status(201).json(rel);
});

app.delete('/api/relationships/:id', (req, res) => {
  deleteRelationship(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

// Import fwendator-style friend JSON (from getFriends.js)
app.post('/api/import/friends', (req, res) => {
  const data = req.body as FwendatorData;
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Invalid friends JSON. Export with getFriends.js first.' });
  }

  const first = Object.values(data)[0];
  if (!first?.name || !first?.avatar || !Array.isArray(first?.mutual)) {
    return res.status(400).json({ error: 'JSON must match fwendator format: { id: { name, avatar, mutual[] } }' });
  }

  const rootUserId = req.session.userId || 'you';
  const result = importFwendatorData(data, rootUserId);
  res.json({ ok: true, ...result });
});

// Discord OAuth
app.get('/auth/discord', (_req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}?auth=not_configured`);
  }
  const state = crypto.randomBytes(16).toString('hex');
  _req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}?auth=not_configured`);
  }

  const { code, state } = req.query;
  if (!code || state !== req.session.oauthState) {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error('No access token');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json() as {
      id: string;
      username: string;
      global_name?: string;
      avatar?: string;
    };

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.id) % 6}.png`;

    const user = upsertUser({
      id: 'you',
      discord_id: discordUser.id,
      username: discordUser.username,
      display_name: discordUser.global_name || discordUser.username,
      avatar_url: avatarUrl,
      status: 'online',
      bio: 'Connected via Discord',
    });

    req.session.userId = user.id;
    res.redirect(`${FRONTEND_URL}?auth=success`);
  } catch {
    res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Discord Family Tree API running on http://localhost:${PORT}`);
});
