import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import { parseRoster } from '../state/csv';

export function CastPanel(): ReactElement {
  const performers = useEditor((s) => s.performers);
  const selectedPerformerIds = useEditor((s) => s.selectedPerformerIds);
  const addPerformer = useEditor((s) => s.addPerformer);
  const importRoster = useEditor((s) => s.importRoster);
  const selectPerformer = useEditor((s) => s.selectPerformer);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState('');

  return (
    <aside className="cast-panel side-panel">
      <div className="panel-title">Cast</div>
      <div className="panel-section">
        <button type="button" className="btn" onClick={addPerformer}>
          Add performer
        </button>
        <button
          type="button"
          className="btn"
          title="CSV columns: name, role, color (header row optional)"
          onClick={() => fileRef.current?.click()}
        >
          Import CSV
        </button>
        {importNote !== '' && (
          <span className="mono" role="status">
            {importNote}
          </span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label="Roster CSV file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file === undefined) return;
          void file.text().then((text) => {
            const rows = parseRoster(text);
            if (rows.length === 0) {
              setImportNote('No rows found — expected: name, role, color');
            } else {
              importRoster(rows);
              setImportNote(`Imported ${rows.length} performer${rows.length === 1 ? '' : 's'}`);
            }
          });
          e.target.value = '';
        }}
      />
      {performers.length === 0 ? (
        <p className="empty-note">
          No performers yet. Add one, then drag their mark onto the stage.
        </p>
      ) : (
        <div role="listbox" aria-label="Performers" aria-multiselectable="true">
          {performers.map((p) => {
            const selected = selectedPerformerIds.includes(p.id);
            return (
              <div
                key={p.id}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                className={`cast-row${selected ? ' selected' : ''}`}
                onClick={(e) => selectPerformer(p.id, e.shiftKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectPerformer(p.id, e.shiftKey);
                  }
                }}
              >
                <span className="cast-dot" style={{ background: p.color }} />
                <span className="cast-name">{p.name}</span>
                {p.role !== '' && <span className="cast-role">{p.role}</span>}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
