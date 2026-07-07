import { useRef, useState } from 'react';
import { getFriendsScriptUrl, importFriends, resetToDemo } from '../api';
import type { FwendatorData } from '../import';
import './ImportPanel.css';

interface Props {
  onImported: () => void;
}

export default function ImportPanel({ onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const scriptUrl = getFriendsScriptUrl();

  const handleFile = async (file: File) => {
    setStatus('loading');
    setMessage('');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as FwendatorData;
      const result = await importFriends(data);
      setStatus('success');
      setMessage(`Imported ${result.imported} friends with ${result.relationships} connections.`);
      setTimeout(onImported, 800);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to parse JSON file.');
    }
  };

  const handleReset = async () => {
    await resetToDemo();
    onImported();
  };

  return (
    <section className="import-panel">
      <h2>Import Your Discord Friends</h2>
      <p className="import-intro">
        This app uses the same method as{' '}
        <a href="https://github.com/Escartem/fwendator" target="_blank" rel="noreferrer">
          fwendator
        </a>
        . Everything runs in your browser — your token never leaves Discord.
      </p>

      <div className="import-steps">
        <div className="step">
          <span className="step-num">1</span>
          <div>
            <h3>Export friends on Discord</h3>
            <p>Open <a href="https://discord.com/app" target="_blank" rel="noreferrer">discord.com/app</a> while logged in, press <kbd>F12</kbd>, go to Console, and paste the exporter script. No token needed — it uses your active session.</p>
            <a className="script-link" href={scriptUrl} target="_blank" rel="noreferrer">
              View getFriends.js script
            </a>
          </div>
        </div>

        <div className="step">
          <span className="step-num">2</span>
          <div>
            <h3>Download the JSON</h3>
            <p>When the script finishes, click the download button. It saves a <code>friends-*.json</code> file.</p>
          </div>
        </div>

        <div className="step">
          <span className="step-num">3</span>
          <div>
            <h3>Upload here</h3>
            <p>Load that JSON into your family tree. Data stays in your browser (localStorage).</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              className="btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Importing…' : 'Choose JSON file'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p className={`import-status ${status}`}>{message}</p>
      )}

      <div className="import-warning">
        <strong>Note:</strong> Using your Discord token in the console is considered self-botting and is against Discord&apos;s Terms of Service.
        The token is only used locally in your browser to fetch your friend list — it is never sent to this site or any server.
        Use at your own risk.
      </div>

      <div className="import-footer">
        <button className="btn-secondary" onClick={handleReset}>
          Reset to demo data
        </button>
      </div>
    </section>
  );
}
