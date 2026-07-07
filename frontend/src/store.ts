import type { Relationship, TreeData, User } from './types';
import { importFwendatorData, type FwendatorData } from './import';

const STORAGE_KEY = 'discord-family-tree';

const ROOT_USER: User = {
  id: 'you',
  discord_id: null,
  username: 'you',
  display_name: 'You',
  avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
  status: 'online',
  bio: 'The root of your Discord family tree',
};

function demoData(): TreeData {
  const users: User[] = [
    ROOT_USER,
    { id: 'alex', discord_id: null, username: 'alex_gamer', display_name: 'Alex', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', status: 'online', bio: 'Met in #general, 2019' },
    { id: 'jordan', discord_id: null, username: 'jordan_codes', display_name: 'Jordan', avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png', status: 'idle', bio: 'Co-founded the dev server' },
    { id: 'sam', discord_id: null, username: 'sam_irl', display_name: 'Sam', avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png', status: 'dnd', bio: 'IRL friend who dragged you onto Discord' },
    { id: 'riley', discord_id: null, username: 'riley_art', display_name: 'Riley', avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png', status: 'online', bio: 'Met through Alex' },
    { id: 'casey', discord_id: null, username: 'casey_mod', display_name: 'Casey', avatar_url: 'https://cdn.discordapp.com/embed/avatars/5.png', status: 'offline', bio: 'Server mod since day one' },
    { id: 'morgan', discord_id: null, username: 'morgan_music', display_name: 'Morgan', avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png', status: 'online', bio: 'Voice chat regular' },
    { id: 'taylor', discord_id: null, username: 'taylor_nitro', display_name: 'Taylor', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', status: 'idle', bio: 'Nitro booster' },
  ];

  let id = 1;
  const rel = (from_id: string, to_id: string, type: Relationship['type'], label: string): Relationship => ({
    id: id++, user_id: 'you', from_id, to_id, type, label,
  });

  const relationships: Relationship[] = [
    rel('sam', 'you', 'parent', 'Introduced you to Discord'),
    rel('you', 'sam', 'child', 'Your first Discord friend'),
    rel('you', 'alex', 'friend', 'Gaming buddy'),
    rel('you', 'jordan', 'friend', 'Dev partner'),
    rel('you', 'casey', 'friend', 'Server mod'),
    rel('you', 'morgan', 'friend', 'VC regular'),
    rel('you', 'taylor', 'friend', 'Meme dealer'),
    rel('alex', 'riley', 'child', 'Met through Alex'),
    rel('alex', 'jordan', 'sibling', 'Same server'),
    rel('morgan', 'taylor', 'sibling', 'VC crew'),
  ];

  return { users, relationships };
}

interface StoredState {
  users: User[];
  relationships: Relationship[];
  isImported: boolean;
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredState;
  } catch {
    // ignore corrupt storage
  }
  const demo = demoData();
  return { users: demo.users, relationships: demo.relationships, isImported: false };
}

function save(state: StoredState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getTree(): TreeData {
  const { users, relationships } = load();
  return { users, relationships };
}

export function getMe(): { user: User; isDemo: boolean } {
  const state = load();
  const user = state.users.find((u) => u.id === 'you') || ROOT_USER;
  return { user, isDemo: !state.isImported };
}

export function importFriends(data: FwendatorData): { imported: number; relationships: number } {
  const root = load().users.find((u) => u.id === 'you') || ROOT_USER;
  const { users, relationships } = importFwendatorData(data, root);
  save({ users, relationships, isImported: true });
  return { imported: users.length - 1, relationships: relationships.length };
}

export function resetToDemo(): void {
  const demo = demoData();
  save({ users: demo.users, relationships: demo.relationships, isImported: false });
}

export function updateRootProfile(updates: Partial<Pick<User, 'display_name' | 'avatar_url' | 'username'>>): User {
  const state = load();
  const idx = state.users.findIndex((u) => u.id === 'you');
  if (idx >= 0) {
    state.users[idx] = { ...state.users[idx], ...updates };
  } else {
    state.users.unshift({ ...ROOT_USER, ...updates });
  }
  save(state);
  return state.users.find((u) => u.id === 'you')!;
}
