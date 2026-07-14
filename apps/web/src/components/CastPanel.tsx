import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import { parseRoster } from '../state/csv';
import { useT } from '../i18n';

export function CastPanel(): ReactElement {
  const t = useT();
  const performers = useEditor((s) => s.performers);
  const selectedPerformerIds = useEditor((s) => s.selectedPerformerIds);
  const addPerformer = useEditor((s) => s.addPerformer);
  const importRoster = useEditor((s) => s.importRoster);
  const selectPerformer = useEditor((s) => s.selectPerformer);
  const setPerformerSelection = useEditor((s) => s.setPerformerSelection);
  const props = useEditor((s) => s.props);
  const selectedPropId = useEditor((s) => s.selectedPropId);
  const addProp = useEditor((s) => s.addProp);
  const selectProp = useEditor((s) => s.selectProp);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState('');

  // Every group name in use, with its members — one chip per group.
  const groups = new Map<string, string[]>();
  for (const p of performers) {
    for (const tag of p.tags ?? []) {
      groups.set(tag, [...(groups.get(tag) ?? []), p.id]);
    }
  }
  const groupNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <aside className="cast-panel side-panel">
      <div className="panel-title">{t.cast.title}</div>
      <div className="panel-section">
        <button type="button" className="btn" onClick={addPerformer}>
          {t.cast.addPerformer}
        </button>
        <button
          type="button"
          className="btn"
          title={t.cast.importCsvTitle}
          onClick={() => fileRef.current?.click()}
        >
          {t.cast.importCsv}
        </button>
        {importNote !== '' && (
          <span className="mono" role="status">
            {importNote}
          </span>
        )}
        {groupNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {groupNames.map((name) => (
              <button
                key={name}
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '2px 8px' }}
                aria-label={t.cast.selectGroupAria(name)}
                title={t.cast.selectGroupTitle}
                onClick={() => setPerformerSelection(groups.get(name) ?? [])}
              >
                {name} · {groups.get(name)?.length ?? 0}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label={t.cast.rosterFileAria}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file === undefined) return;
          void file.text().then((text) => {
            const rows = parseRoster(text);
            if (rows.length === 0) {
              setImportNote(t.cast.importEmpty);
            } else {
              importRoster(rows);
              setImportNote(t.cast.imported(rows.length));
            }
          });
          e.target.value = '';
        }}
      />
      {performers.length === 0 ? (
        <p className="empty-note">{t.cast.emptyNote}</p>
      ) : (
        <div role="listbox" aria-label={t.cast.performersAria} aria-multiselectable="true">
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
      <div className="panel-title">{t.props.title}</div>
      <div className="panel-section">
        <button
          type="button"
          className="btn"
          title={t.props.addTitle}
          onClick={() => addProp('rect')}
        >
          {t.props.add}
        </button>
      </div>
      {props.length > 0 && (
        <div role="listbox" aria-label={t.props.listAria}>
          {props.map((prop) => {
            const selected = selectedPropId === prop.id;
            const glyph = prop.kind === 'circle' ? '●' : prop.kind === 'triangle' ? '▲' : '■';
            return (
              <div
                key={prop.id}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                className={`cast-row${selected ? ' selected' : ''}`}
                onClick={() => selectProp(selected ? null : prop.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectProp(selected ? null : prop.id);
                  }
                }}
              >
                <span style={{ color: prop.color, fontSize: 10 }}>{glyph}</span>
                <span className="cast-name">{prop.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
