import { useCallback, useEffect, useState } from 'react';
import { fetchMe, fetchTree } from './api';
import type { MeResponse, TreeData, User } from './types';
import Header from './components/Header';
import FamilyTree from './components/FamilyTree';
import ImportPanel from './components/ImportPanel';
import PersonDetail from './components/PersonDetail';
import './App.css';

type View = 'tree' | 'import';

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tree, setTree] = useState<TreeData | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [view, setView] = useState<View>('tree');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meData, treeData] = await Promise.all([fetchMe(), fetchTree()]);
      setMe(meData);
      setTree(treeData);
      if (!selected && meData.user) setSelected(meData.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onImported = () => {
    setView('tree');
    load();
  };

  if (loading && !tree) {
    return <div className="loading">Growing your family tree…</div>;
  }

  return (
    <div className="app">
      <Header
        user={me?.user}
        isDemo={me?.isDemo ?? true}
        view={view}
        onViewChange={setView}
        onRefresh={load}
      />

      <main className="main">
        {view === 'import' ? (
          <ImportPanel onImported={onImported} />
        ) : (
          <>
            <section className="tree-section">
              <div className="tree-header">
                <h1>Your Discord Family Tree</h1>
                <p className="subtitle">
                  An Ancestry-style view of your Discord friends and how they connect.
                </p>
              </div>
              {tree && (
                <FamilyTree
                  users={tree.users}
                  relationships={tree.relationships}
                  rootId={me?.user?.id || 'you'}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                />
              )}
            </section>
            {selected && (
              <PersonDetail
                person={selected}
                relationships={tree?.relationships || []}
                users={tree?.users || []}
                onClose={() => setSelected(null)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
