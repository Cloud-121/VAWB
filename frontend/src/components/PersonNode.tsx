import type { User } from '../types';
import './PersonNode.css';

const STATUS_COLORS: Record<string, string> = {
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
};

interface Props {
  user: User;
  isRoot?: boolean;
  isSelected?: boolean;
  onClick: () => void;
}

export default function PersonNode({ user, isRoot, isSelected, onClick }: Props) {
  const name = user.display_name || user.username;
  const statusColor = STATUS_COLORS[user.status] || STATUS_COLORS.offline;

  return (
    <button
      className={`person-node ${isRoot ? 'is-root' : ''} ${isSelected ? 'is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className="avatar-ring" style={{ borderColor: statusColor }}>
        <img
          src={user.avatar_url || `https://cdn.discordapp.com/embed/avatars/0.png`}
          alt={name}
          className="avatar"
        />
      </div>
      <span className="person-name">{name}</span>
      <span className="person-username">@{user.username}</span>
      {isRoot && <span className="root-badge">You</span>}
    </button>
  );
}
