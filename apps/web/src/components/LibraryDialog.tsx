import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import {
  createDoc,
  deleteDoc,
  duplicateDoc,
  importDocIntoLibrary,
  listLibrary,
  openDoc,
  saveActiveDoc,
  setDocArchived,
  setDocTags,
} from '../state/library';
import { parseDocFile } from '../state/docFile';
import type { LibraryEntry } from '../state/library';
import { isCollabActive } from '../collab/collab';
import { NumberField } from './NumberField';
import { useT } from '../i18n';

/** Common venue footprints for the new-choreography form. */
const STAGE_SIZES = [
  { key: 'proscenium', w: 12, h: 8 },
  { key: 'classroom', w: 10, h: 8 },
  { key: 'blackbox', w: 8, h: 8 },
  { key: 'gym', w: 20, h: 15 },
  { key: 'custom', w: 0, h: 0 },
] as const;
type StageSizeKey = (typeof STAGE_SIZES)[number]['key'];

const parseTags = (raw: string): string[] =>
  raw
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

/**
 * The choreography library: every document in this browser — switch, create,
 * duplicate, tag, archive, delete. Renders its own trigger button; the native
 * <dialog> handles modality and Escape-to-close.
 */
export function LibraryDialog(): ReactElement {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeId = useEditor((s) => s.performance.id);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [sizeKey, setSizeKey] = useState<StageSizeKey>('proscenium');
  const [customW, setCustomW] = useState(12);
  const [customH, setCustomH] = useState(8);
  const [importNote, setImportNote] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  // Switching documents mid-session would corrupt the shared Yjs doc.
  const collab = isCollabActive();

  const onImportFile = (file: File): void => {
    void file.text().then((text) => {
      const doc = parseDocFile(text);
      if (doc === null) {
        setImportNote(t.library.importFailed);
        window.setTimeout(() => setImportNote(''), 4000);
        return;
      }
      importDocIntoLibrary(doc);
      dialogRef.current?.close();
    });
  };

  const refresh = (): void => {
    saveActiveDoc();
    setEntries(listLibrary());
  };

  const q = query.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      q === '' ||
      e.title.toLowerCase().includes(q) ||
      e.tags.some((tag) => tag.toLowerCase().includes(q)),
  );
  const current = visible.filter((e) => !e.archived);
  const archived = visible.filter((e) => e.archived);

  const row = (entry: LibraryEntry): ReactElement => {
    const isActive = entry.id === activeId;
    return (
      <li key={entry.id} className="library-row">
        <div className="library-row-main">
          <span className="library-row-title">
            {entry.title}
            {isActive && <span className="library-current"> · {t.library.current}</span>}
          </span>
          <span className="mono">
            {t.library.updated(new Date(entry.updatedAt).toLocaleString(t.dateLocale))}
          </span>
          <input
            type="text"
            className="library-tags"
            key={entry.tags.join(',')}
            defaultValue={entry.tags.join(', ')}
            placeholder={t.library.tagsPlaceholder}
            aria-label={t.library.tagsAria(entry.title)}
            onBlur={(e) => {
              setDocTags(entry.id, parseTags(e.target.value));
              setEntries(listLibrary());
            }}
          />
        </div>
        <div className="library-row-actions">
          <button
            type="button"
            className="btn"
            disabled={isActive || collab}
            aria-label={t.library.openAria(entry.title)}
            onClick={() => {
              if (openDoc(entry.id)) dialogRef.current?.close();
            }}
          >
            {t.library.openDoc}
          </button>
          <button
            type="button"
            className="btn"
            aria-label={t.library.duplicateAria(entry.title)}
            onClick={() => {
              duplicateDoc(entry.id, t.library.copyTitle(entry.title));
              refresh();
            }}
          >
            {t.library.duplicate}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDocArchived(entry.id, !entry.archived);
              setEntries(listLibrary());
            }}
          >
            {entry.archived ? t.library.unarchive : t.library.archive}
          </button>
          <button
            type="button"
            className="btn"
            disabled={isActive}
            aria-label={t.library.deleteAria(entry.title)}
            onClick={() => {
              if (window.confirm(t.library.deleteConfirm(entry.title))) {
                deleteDoc(entry.id);
                setEntries(listLibrary());
              }
            }}
          >
            {t.library.delete}
          </button>
        </div>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        title={t.library.openTitle}
        onClick={() => {
          refresh();
          dialogRef.current?.showModal();
        }}
      >
        {t.library.open}
      </button>
      <dialog ref={dialogRef} className="export-dialog library-dialog" aria-label={t.library.title}>
        <div className="export-dialog-head">
          <span className="panel-title" style={{ margin: 0 }}>
            {t.library.title}
          </span>
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            {t.library.close}
          </button>
        </div>
        <div className="library-body">
          <input
            type="search"
            aria-label={t.library.searchAria}
            placeholder={t.library.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {collab && <p className="empty-note">{t.library.collabNote}</p>}
          {current.length <= 1 && archived.length === 0 && (
            <p className="empty-note">{t.library.empty}</p>
          )}
          <ul className="library-list" aria-label={t.library.listAria}>
            {current.map(row)}
          </ul>
          {archived.length > 0 && (
            <>
              <span className="panel-title">{t.library.archivedSection}</span>
              <ul className="library-list" aria-label={t.library.archivedSection}>
                {archived.map(row)}
              </ul>
            </>
          )}
        </div>
        <div className="export-dialog-foot library-new-foot">
          {!showNewForm ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={collab}
                onClick={() => setShowNewForm(true)}
              >
                {t.library.newDoc}
              </button>
              <button
                type="button"
                className="btn"
                disabled={collab}
                title={t.library.importTitle}
                onClick={() => importInputRef.current?.click()}
              >
                {t.library.importDoc}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                aria-label={t.library.importFileAria}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ''; // allow re-picking the same file
                  if (file !== undefined) onImportFile(file);
                }}
              />
              {importNote !== '' && (
                <span className="mono" role="status">
                  {importNote}
                </span>
              )}
            </>
          ) : (
            <div className="library-new-form">
              <input
                type="text"
                aria-label={t.library.newTitleAria}
                placeholder={t.library.newTitlePlaceholder}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <select
                aria-label={t.library.sizeAria}
                value={sizeKey}
                onChange={(e) => setSizeKey(e.target.value as StageSizeKey)}
              >
                {STAGE_SIZES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {t.library.sizes[s.key]}
                    {s.w > 0 ? ` (${s.w}×${s.h}m)` : ''}
                  </option>
                ))}
              </select>
              {sizeKey === 'custom' && (
                <>
                  <NumberField
                    aria-label={t.stage.width}
                    min={2}
                    max={60}
                    style={{ width: 70 }}
                    value={customW}
                    onCommit={setCustomW}
                  />
                  <NumberField
                    aria-label={t.stage.depth}
                    min={2}
                    max={60}
                    style={{ width: 70 }}
                    value={customH}
                    onCommit={setCustomH}
                  />
                </>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const preset = STAGE_SIZES.find((s) => s.key === sizeKey);
                  const w = sizeKey === 'custom' ? customW : (preset?.w ?? 12);
                  const h = sizeKey === 'custom' ? customH : (preset?.h ?? 8);
                  createDoc({ title: newTitle, stageWidth: w, stageHeight: h });
                  setShowNewForm(false);
                  setNewTitle('');
                  dialogRef.current?.close();
                }}
              >
                {t.library.create}
              </button>
              <button type="button" className="btn" onClick={() => setShowNewForm(false)}>
                {t.library.cancel}
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
