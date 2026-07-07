import * as store from './store';
import type { FwendatorData } from './import';
import type { MeResponse, TreeData } from './types';

export async function fetchMe(): Promise<MeResponse> {
  return store.getMe();
}

export async function fetchTree(): Promise<TreeData> {
  return store.getTree();
}

export async function importFriends(data: FwendatorData): Promise<{ ok: boolean; imported: number; relationships: number }> {
  const result = store.importFriends(data);
  return { ok: true, ...result };
}

export async function resetToDemo(): Promise<void> {
  store.resetToDemo();
}

export function getFriendsScriptUrl(): string {
  const base = import.meta.env.BASE_URL;
  return `${base}getFriends.js`;
}
