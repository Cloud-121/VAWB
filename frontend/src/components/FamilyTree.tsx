import { useMemo } from 'react';
import type { Relationship, User } from '../types';
import PersonNode from './PersonNode';
import './FamilyTree.css';

interface Props {
  users: User[];
  relationships: Relationship[];
  rootId: string;
  selectedId?: string;
  onSelect: (user: User) => void;
}

interface TreeLevel {
  users: User[];
  label: string;
}

function buildLevels(
  users: User[],
  relationships: Relationship[],
  rootId: string,
): TreeLevel[] {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const root = userMap.get(rootId);
  if (!root) return [];

  const directFriends = relationships
    .filter((r) => r.type === 'friend' && r.from_id === rootId)
    .map((r) => userMap.get(r.to_id))
    .filter(Boolean) as User[];

  const parents = relationships
    .filter((r) => r.type === 'parent' && r.to_id === rootId)
    .map((r) => userMap.get(r.from_id))
    .filter(Boolean) as User[];

  const childrenOfFriends = new Map<string, User[]>();
  for (const rel of relationships.filter((r) => r.type === 'child')) {
    const parent = rel.from_id;
    const child = userMap.get(rel.to_id);
    if (child && parent !== rootId) {
      if (!childrenOfFriends.has(parent)) childrenOfFriends.set(parent, []);
      childrenOfFriends.get(parent)!.push(child);
    }
  }

  const levels: TreeLevel[] = [];

  if (parents.length > 0) {
    levels.push({ label: 'Who brought you here', users: parents });
  }

  levels.push({ label: 'You', users: [root] });

  if (directFriends.length > 0) {
    levels.push({ label: 'Your Discord friends', users: directFriends });
  }

  const secondGen = new Set<string>();
  for (const friends of childrenOfFriends.values()) {
    for (const u of friends) {
      if (u.id !== rootId && !directFriends.some((f) => f.id === u.id)) {
        secondGen.add(u.id);
      }
    }
  }
  const secondGenUsers = [...secondGen].map((id) => userMap.get(id)).filter(Boolean) as User[];
  if (secondGenUsers.length > 0) {
    levels.push({ label: 'Friend clusters', users: secondGenUsers });
  }

  return levels;
}

function getSiblingPairs(relationships: Relationship[]): [string, string][] {
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const r of relationships.filter((rel) => rel.type === 'sibling')) {
    const key = [r.from_id, r.to_id].sort().join('-');
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push([r.from_id, r.to_id]);
    }
  }
  return pairs;
}

export default function FamilyTree({ users, relationships, rootId, selectedId, onSelect }: Props) {
  const levels = useMemo(
    () => buildLevels(users, relationships, rootId),
    [users, relationships, rootId],
  );

  const siblingPairs = useMemo(
    () => getSiblingPairs(relationships),
    [relationships],
  );

  if (users.length === 0) {
    return (
      <div className="tree-empty">
        <p>No friends in your tree yet.</p>
        <p>Go to <strong>Import Friends</strong> to load your Discord friend list.</p>
      </div>
    );
  }

  return (
    <div className="family-tree">
      {levels.map((level, i) => (
        <div key={level.label} className="tree-generation">
          {i > 0 && <div className="generation-connector" aria-hidden />}
          <p className="generation-label">{level.label}</p>
          <div className="generation-row">
            {level.users.map((user) => (
              <PersonNode
                key={user.id}
                user={user}
                isRoot={user.id === rootId}
                isSelected={user.id === selectedId}
                onClick={() => onSelect(user)}
              />
            ))}
          </div>
        </div>
      ))}

      {siblingPairs.length > 0 && (
        <div className="sibling-legend">
          <span className="legend-title">Mutual friend connections</span>
          <div className="sibling-chips">
            {siblingPairs.slice(0, 12).map(([a, b]) => {
              const ua = users.find((u) => u.id === a);
              const ub = users.find((u) => u.id === b);
              if (!ua || !ub) return null;
              return (
                <span key={`${a}-${b}`} className="sibling-chip">
                  {ua.display_name || ua.username} ↔ {ub.display_name || ub.username}
                </span>
              );
            })}
            {siblingPairs.length > 12 && (
              <span className="sibling-chip more">+{siblingPairs.length - 12} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
