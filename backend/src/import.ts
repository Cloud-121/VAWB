import { upsertUser, createRelationship, deleteUser, getRelationshipsForUser } from './db.js';

/** fwendator JSON format from getFriends.js */
export interface FwendatorFriend {
  name: string;
  avatar: string;
  /** Discord user IDs that this friend is also friends with */
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

export function importFwendatorData(
  data: FwendatorData,
  rootUserId = 'you',
): { imported: number; relationships: number } {
  const friendIds = Object.keys(data);
  let relationships = 0;

  // Clear existing non-root users and their relationships for a fresh import
  const existingRels = getRelationshipsForUser(rootUserId);
  for (const rel of existingRels) {
    if (rel.from_id !== rootUserId && rel.to_id !== rootUserId) continue;
    const otherId = rel.from_id === rootUserId ? rel.to_id : rel.from_id;
    if (otherId !== rootUserId && friendIds.includes(otherId)) {
      // will be recreated below
    }
  }

  // Remove old imported friends (discord_id matches keys in data)
  for (const id of friendIds) {
    try {
      deleteUser(id);
    } catch {
      // user may not exist yet
    }
  }

  // Create user records for each friend
  for (const [discordId, info] of Object.entries(data)) {
    const { username, displayName } = parseDisplayName(info.name);
    upsertUser({
      id: discordId,
      discord_id: discordId,
      username,
      display_name: displayName,
      avatar_url: info.avatar,
      status: 'offline',
      bio: `${info.mutual.length} mutual connection${info.mutual.length === 1 ? '' : 's'}`,
    });
  }

  // Direct friend links: you -> each friend
  for (const discordId of friendIds) {
    createRelationship({
      user_id: rootUserId,
      from_id: rootUserId,
      to_id: discordId,
      type: 'friend',
      label: 'Discord friend',
    });
    relationships++;
  }

  // Sibling links: friends who are also friends with each other
  const friendIdSet = new Set(friendIds);
  for (let i = 0; i < friendIds.length; i++) {
    for (let j = i + 1; j < friendIds.length; j++) {
      const a = friendIds[i];
      const b = friendIds[j];
      const aMutual = new Set(data[a].mutual);
      const bMutual = new Set(data[b].mutual);
      const aKnowsB = aMutual.has(b);
      const bKnowsA = bMutual.has(a);
      if (aKnowsB || bKnowsA) {
        createRelationship({
          user_id: rootUserId,
          from_id: a,
          to_id: b,
          type: 'sibling',
          label: 'Mutual friends',
        });
        relationships++;
      }
    }
  }

  // Cluster "children" under friends with the most mutual connections (2nd generation feel)
  const sortedByMutual = [...friendIds].sort(
    (a, b) => data[b].mutual.filter((m) => friendIdSet.has(m)).length -
              data[a].mutual.filter((m) => friendIdSet.has(m)).length,
  );

  // Top connectors become "parent" nodes for smaller clusters
  for (const hubId of sortedByMutual.slice(0, Math.min(3, sortedByMutual.length))) {
    const innerMutuals = data[hubId].mutual.filter((m) => friendIdSet.has(m) && m !== hubId);
    for (const leafId of innerMutuals) {
      if (leafId === hubId) continue;
      const leafInnerCount = data[leafId].mutual.filter((m) => friendIdSet.has(m)).length;
      const hubInnerCount = data[hubId].mutual.filter((m) => friendIdSet.has(m)).length;
      if (leafInnerCount < hubInnerCount) {
        createRelationship({
          user_id: rootUserId,
          from_id: hubId,
          to_id: leafId,
          type: 'child',
          label: 'Friend cluster',
        });
        relationships++;
      }
    }
  }

  return { imported: friendIds.length, relationships };
}
