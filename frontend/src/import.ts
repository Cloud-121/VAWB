import type { Relationship, User } from './types';

export interface FwendatorFriend {
  name: string;
  avatar: string;
  mutual: string[];
}

export type FwendatorData = Record<string, FwendatorFriend>;

function parseDisplayName(name: string): { username: string; displayName: string } {
  const hashIdx = name.lastIndexOf('#');
  if (hashIdx > 0) {
    return { username: name.slice(0, hashIdx), displayName: name.slice(0, hashIdx) };
  }
  return { username: name, displayName: name };
}

let relId = 1;

export function importFwendatorData(
  data: FwendatorData,
  rootUser: User,
): { users: User[]; relationships: Relationship[] } {
  const friendIds = Object.keys(data);
  const users: User[] = [rootUser];
  const relationships: Relationship[] = [];
  relId = 1;

  for (const [discordId, info] of Object.entries(data)) {
    const { username, displayName } = parseDisplayName(info.name);
    users.push({
      id: discordId,
      discord_id: discordId,
      username,
      display_name: displayName,
      avatar_url: info.avatar,
      status: 'offline',
      bio: `${info.mutual.length} mutual connection${info.mutual.length === 1 ? '' : 's'}`,
    });
  }

  for (const discordId of friendIds) {
    relationships.push({
      id: relId++,
      user_id: rootUser.id,
      from_id: rootUser.id,
      to_id: discordId,
      type: 'friend',
      label: 'Discord friend',
    });
  }

  const friendIdSet = new Set(friendIds);
  for (let i = 0; i < friendIds.length; i++) {
    for (let j = i + 1; j < friendIds.length; j++) {
      const a = friendIds[i];
      const b = friendIds[j];
      const aKnowsB = data[a].mutual.includes(b);
      const bKnowsA = data[b].mutual.includes(a);
      if (aKnowsB || bKnowsA) {
        relationships.push({
          id: relId++,
          user_id: rootUser.id,
          from_id: a,
          to_id: b,
          type: 'sibling',
          label: 'Mutual friends',
        });
      }
    }
  }

  const sortedByMutual = [...friendIds].sort(
    (a, b) =>
      data[b].mutual.filter((m) => friendIdSet.has(m)).length -
      data[a].mutual.filter((m) => friendIdSet.has(m)).length,
  );

  for (const hubId of sortedByMutual.slice(0, Math.min(3, sortedByMutual.length))) {
    const innerMutuals = data[hubId].mutual.filter((m) => friendIdSet.has(m) && m !== hubId);
    for (const leafId of innerMutuals) {
      const leafInner = data[leafId].mutual.filter((m) => friendIdSet.has(m)).length;
      const hubInner = data[hubId].mutual.filter((m) => friendIdSet.has(m)).length;
      if (leafInner < hubInner) {
        relationships.push({
          id: relId++,
          user_id: rootUser.id,
          from_id: hubId,
          to_id: leafId,
          type: 'child',
          label: 'Friend cluster',
        });
      }
    }
  }

  return { users, relationships };
}
