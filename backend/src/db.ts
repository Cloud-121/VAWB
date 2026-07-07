import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'offline',
    bio TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('parent', 'child', 'sibling', 'spouse', 'friend')),
    label TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, from_id, to_id, type)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT,
    expires_at TEXT NOT NULL
  );
`);

export interface User {
  id: string;
  discord_id: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  bio: string | null;
  created_at: string;
}

export interface Relationship {
  id: number;
  user_id: string;
  from_id: string;
  to_id: string;
  type: 'parent' | 'child' | 'sibling' | 'spouse' | 'friend';
  label: string | null;
  created_at: string;
}

export function getUser(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByDiscordId(discordId: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) as User | undefined;
}

export function upsertUser(user: Omit<User, 'created_at'>): User {
  db.prepare(`
    INSERT INTO users (id, discord_id, username, display_name, avatar_url, status, bio)
    VALUES (@id, @discord_id, @username, @display_name, @avatar_url, @status, @bio)
    ON CONFLICT(id) DO UPDATE SET
      discord_id = excluded.discord_id,
      username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      status = excluded.status,
      bio = excluded.bio
  `).run(user);
  return getUser(user.id)!;
}

export function getFriendsForTree(rootUserId: string): { users: User[]; relationships: Relationship[] } {
  const users = db.prepare(`
    WITH RECURSIVE tree AS (
      SELECT from_id AS id FROM relationships WHERE user_id = ? AND to_id = ?
      UNION
      SELECT to_id AS id FROM relationships WHERE user_id = ? AND from_id = ?
      UNION
      SELECT r.from_id FROM relationships r
      JOIN tree t ON r.to_id = t.id OR r.from_id = t.id
      WHERE r.user_id = ?
      UNION
      SELECT r.to_id FROM relationships r
      JOIN tree t ON r.from_id = t.id OR r.to_id = t.id
      WHERE r.user_id = ?
    )
    SELECT DISTINCT u.* FROM users u
    WHERE u.id = ? OR u.id IN (SELECT id FROM tree)
  `).all(rootUserId, rootUserId, rootUserId, rootUserId, rootUserId, rootUserId, rootUserId) as User[];

  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return { users: [], relationships: [] };

  const placeholders = userIds.map(() => '?').join(',');
  const relationships = db.prepare(`
    SELECT * FROM relationships
    WHERE user_id = ? AND from_id IN (${placeholders}) AND to_id IN (${placeholders})
  `).all(rootUserId, ...userIds, ...userIds) as Relationship[];

  return { users, relationships };
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY username').all() as User[];
}

export function createUser(user: Omit<User, 'created_at'>): User {
  db.prepare(`
    INSERT INTO users (id, discord_id, username, display_name, avatar_url, status, bio)
    VALUES (@id, @discord_id, @username, @display_name, @avatar_url, @status, @bio)
  `).run(user);
  return getUser(user.id)!;
}

export function deleteUser(id: string): void {
  db.prepare('DELETE FROM relationships WHERE from_id = ? OR to_id = ?').run(id, id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function createRelationship(rel: Omit<Relationship, 'id' | 'created_at'>): Relationship {
  const result = db.prepare(`
    INSERT INTO relationships (user_id, from_id, to_id, type, label)
    VALUES (@user_id, @from_id, @to_id, @type, @label)
    ON CONFLICT(user_id, from_id, to_id, type) DO UPDATE SET label = excluded.label
    RETURNING *
  `).get(rel) as Relationship;
  return result;
}

export function deleteRelationship(id: number): void {
  db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
}

export function getRelationshipsForUser(userId: string): Relationship[] {
  return db.prepare('SELECT * FROM relationships WHERE user_id = ?').all(userId) as Relationship[];
}

export function seedDemoData(): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existing.count > 0) return;

  const users: Omit<User, 'created_at'>[] = [
    { id: 'you', discord_id: null, username: 'you', display_name: 'You', avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png', status: 'online', bio: 'The root of your Discord family tree' },
    { id: 'alex', discord_id: null, username: 'alex_gamer', display_name: 'Alex', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', status: 'online', bio: 'Met in #general, 2019' },
    { id: 'jordan', discord_id: null, username: 'jordan_codes', display_name: 'Jordan', avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png', status: 'idle', bio: 'Co-founded the dev server together' },
    { id: 'sam', discord_id: null, username: 'sam_irl', display_name: 'Sam', avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png', status: 'dnd', bio: 'IRL friend who dragged you onto Discord' },
    { id: 'riley', discord_id: null, username: 'riley_art', display_name: 'Riley', avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png', status: 'online', bio: 'Amazing artist, met through Alex' },
    { id: 'casey', discord_id: null, username: 'casey_mod', display_name: 'Casey', avatar_url: 'https://cdn.discordapp.com/embed/avatars/5.png', status: 'offline', bio: 'Server mod since day one' },
    { id: 'morgan', discord_id: null, username: 'morgan_music', display_name: 'Morgan', avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png', status: 'online', bio: 'Voice chat regular' },
    { id: 'taylor', discord_id: null, username: 'taylor_nitro', display_name: 'Taylor', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', status: 'idle', bio: 'Nitro booster, meme lord' },
    { id: 'quinn', discord_id: null, username: 'quinn_lfg', display_name: 'Quinn', avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png', status: 'online', bio: 'LFG partner for everything' },
    { id: 'drew', discord_id: null, username: 'drew_dev', display_name: 'Drew', avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png', status: 'offline', bio: 'Pair programming buddy' },
    { id: 'jamie', discord_id: null, username: 'jamie_vc', display_name: 'Jamie', avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png', status: 'dnd', bio: 'Always in voice' },
  ];

  for (const u of users) createUser(u);

  const rels: Omit<Relationship, 'id' | 'created_at'>[] = [
    // Sam introduced you to Discord (parent)
    { user_id: 'you', from_id: 'sam', to_id: 'you', type: 'parent', label: 'Introduced you to Discord' },
    { user_id: 'you', from_id: 'you', to_id: 'sam', type: 'child', label: 'Your first Discord friend' },
    // Direct friends
    { user_id: 'you', from_id: 'you', to_id: 'alex', type: 'friend', label: 'Gaming buddy' },
    { user_id: 'you', from_id: 'you', to_id: 'jordan', type: 'friend', label: 'Dev partner' },
    { user_id: 'you', from_id: 'you', to_id: 'casey', type: 'friend', label: 'Server mod' },
    { user_id: 'you', from_id: 'you', to_id: 'morgan', type: 'friend', label: 'VC regular' },
    { user_id: 'you', from_id: 'you', to_id: 'taylor', type: 'friend', label: 'Meme dealer' },
    { user_id: 'you', from_id: 'you', to_id: 'quinn', type: 'friend', label: 'LFG squad' },
  ];

  // Alex's branch
  rels.push(
    { user_id: 'you', from_id: 'alex', to_id: 'riley', type: 'child', label: 'Met through Alex' },
    { user_id: 'you', from_id: 'riley', to_id: 'alex', type: 'parent', label: 'Art commission buddy' },
  );

  // Jordan's branch
  rels.push(
    { user_id: 'you', from_id: 'jordan', to_id: 'drew', type: 'child', label: 'Dev server friend' },
    { user_id: 'you', from_id: 'drew', to_id: 'jordan', type: 'parent', label: 'Code mentor' },
  );

  // Siblings (friends who know each other)
  rels.push(
    { user_id: 'you', from_id: 'alex', to_id: 'jordan', type: 'sibling', label: 'Same server' },
    { user_id: 'you', from_id: 'morgan', to_id: 'jamie', type: 'sibling', label: 'VC crew' },
    { user_id: 'you', from_id: 'you', to_id: 'jamie', type: 'friend', label: 'Voice chat' },
    { user_id: 'you', from_id: 'jamie', to_id: 'morgan', type: 'sibling', label: 'Always in VC together' },
  );

  for (const r of rels) createRelationship(r);
}

export default db;
