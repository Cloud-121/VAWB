import type { Relationship, User } from '../types';
import './PersonDetail.css';

interface Props {
  person: User;
  relationships: Relationship[];
  users: User[];
  onClose: () => void;
}

export default function PersonDetail({ person, relationships, users, onClose }: Props) {
  const name = person.display_name || person.username;
  const userMap = new Map(users.map((u) => [u.id, u]));

  const related = relationships
    .filter((r) => r.from_id === person.id || r.to_id === person.id)
    .map((r) => {
      const otherId = r.from_id === person.id ? r.to_id : r.from_id;
      const other = userMap.get(otherId);
      return { rel: r, other };
    })
    .filter((x) => x.other);

  return (
    <aside className="person-detail">
      <button className="close-btn" onClick={onClose} aria-label="Close">×</button>

      <div className="detail-avatar-wrap">
        <img
          src={person.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}
          alt={name}
          className="detail-avatar"
        />
      </div>

      <h2>{name}</h2>
      <p className="detail-username">@{person.username}</p>

      {person.bio && <p className="detail-bio">{person.bio}</p>}

      <div className="detail-status">
        <span className={`status-dot status-${person.status}`} />
        {person.status}
      </div>

      {related.length > 0 && (
        <div className="detail-relations">
          <h3>Connections</h3>
          <ul>
            {related.map(({ rel, other }) => (
              <li key={rel.id}>
                <span className="rel-type">{rel.type}</span>
                <span className="rel-name">{other!.display_name || other!.username}</span>
                {rel.label && <span className="rel-label">{rel.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
