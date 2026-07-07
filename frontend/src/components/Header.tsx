import type { User } from '../types';
import './Header.css';

interface Props {
  user?: User;
  isDemo: boolean;
  view: 'tree' | 'import';
  onViewChange: (v: 'tree' | 'import') => void;
  onRefresh: () => void;
}

export default function Header({ isDemo, view, onViewChange, onRefresh }: Props) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="logo">🌳</span>
        <span className="brand-text">Discord Family Tree</span>
      </div>

      <nav className="header-nav">
        <button
          className={view === 'tree' ? 'nav-active' : ''}
          onClick={() => onViewChange('tree')}
        >
          Family Tree
        </button>
        <button
          className={view === 'import' ? 'nav-active' : ''}
          onClick={() => onViewChange('import')}
        >
          Import Friends
        </button>
      </nav>

      <div className="header-actions">
        {isDemo && <span className="demo-badge">Demo data</span>}
        <button className="btn-secondary" onClick={onRefresh}>Refresh</button>
      </div>
    </header>
  );
}
