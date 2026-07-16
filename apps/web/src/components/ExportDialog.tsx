import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useT } from '../i18n';
import type { VideoMode } from '../export/video';

type ExportKind = 'video' | 'pdf-charts' | 'pdf-sheets' | 'pdf-pack' | 'png' | 'file';

const KINDS: readonly ExportKind[] = [
  'video',
  'pdf-charts',
  'pdf-sheets',
  'pdf-pack',
  'png',
  'file',
];

/**
 * The export page: one place for every output format and its settings
 * (DaVinci-style deliver dialog — new formats and options land here).
 * Renders its own trigger button; the native <dialog> handles modality
 * and Escape-to-close.
 */
export function ExportDialog(): ReactElement {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ExportKind>('video');
  const [videoMode, setVideoMode] = useState<VideoMode>('2d');
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const videoAbortRef = useRef<AbortController | null>(null);

  const kindLabel = (k: ExportKind): string =>
    k === 'video'
      ? t.export.video
      : k === 'pdf-charts'
        ? t.export.pdfCharts
        : k === 'pdf-sheets'
          ? t.export.pdfSheets
          : k === 'pdf-pack'
            ? t.export.pdfPack
            : k === 'png'
              ? t.export.png
              : t.export.file;

  const startVideo = (): void => {
    if (videoProgress !== null) {
      videoAbortRef.current?.abort(); // second click = cancel
      return;
    }
    const controller = new AbortController();
    videoAbortRef.current = controller;
    setVideoProgress(0);
    void import('../export/video')
      .then((m) =>
        m.exportPerformanceVideo({
          mode: videoMode,
          onProgress: setVideoProgress,
          signal: controller.signal,
        }),
      )
      .catch((err: unknown) => {
        setNote(err instanceof Error ? err.message : t.export.videoExportFailed);
        window.setTimeout(() => setNote(''), 4000);
      })
      .finally(() => setVideoProgress(null));
  };

  const showError = (err: unknown): void => {
    setNote(err instanceof Error ? err.message : String(err));
    window.setTimeout(() => setNote(''), 4000);
  };

  const startExport = (): void => {
    // PDF exports are async (the CJK font may need downloading) — surface
    // failures in the dialog instead of a silent rejection.
    if (kind === 'pdf-charts')
      import('../export/pdf').then((m) => m.exportPerformancePdf()).catch(showError);
    else if (kind === 'pdf-sheets')
      import('../export/walkSheets').then((m) => m.exportWalkSheetsPdf()).catch(showError);
    else if (kind === 'pdf-pack')
      import('../export/pack').then((m) => m.exportRehearsalPackPdf()).catch(showError);
    else if (kind === 'png')
      import('../export/png').then((m) => m.exportFormationPng()).catch(showError);
    else if (kind === 'file')
      import('../state/docFile').then((m) => m.exportActiveDocFile()).catch(showError);
    else startVideo();
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => dialogRef.current?.showModal()}>
        {t.export.open}
      </button>
      <dialog ref={dialogRef} className="export-dialog" aria-label={t.export.title}>
        <div className="export-dialog-head">
          <span className="panel-title" style={{ margin: 0 }}>
            {t.export.title}
          </span>
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            {t.export.close}
          </button>
        </div>
        <div className="export-dialog-body">
          <nav className="export-kinds" aria-label={t.export.kindAria}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`btn export-kind${k === kind ? ' export-kind-active' : ''}`}
                aria-pressed={k === kind}
                onClick={() => setKind(k)}
              >
                {kindLabel(k)}
              </button>
            ))}
          </nav>
          <div className="export-settings">
            {kind === 'video' && (
              <>
                <div className="field">
                  <label htmlFor="export-video-view">{t.export.videoViewLabel}</label>
                  <select
                    id="export-video-view"
                    aria-label={t.export.videoViewAria}
                    value={videoMode}
                    disabled={videoProgress !== null}
                    onChange={(e) => setVideoMode(e.target.value === '3d' ? '3d' : '2d')}
                  >
                    <option value="2d">2D</option>
                    <option value="3d">3D</option>
                  </select>
                </div>
                <p className="empty-note">{t.export.videoNote}</p>
              </>
            )}
            {kind === 'pdf-charts' && <p className="empty-note">{t.export.chartsNote}</p>}
            {kind === 'pdf-sheets' && <p className="empty-note">{t.export.sheetsNote}</p>}
            {kind === 'pdf-pack' && <p className="empty-note">{t.export.packNote}</p>}
            {kind === 'png' && <p className="empty-note">{t.export.pngNote}</p>}
            {kind === 'file' && <p className="empty-note">{t.export.fileNote}</p>}
            {note !== '' && (
              <span className="mono" role="status">
                {note}
              </span>
            )}
          </div>
        </div>
        <div className="export-dialog-foot">
          <button type="button" className="btn btn-primary" onClick={startExport}>
            {videoProgress === null
              ? t.export.start
              : t.export.cancel(Math.round(videoProgress * 100))}
          </button>
        </div>
      </dialog>
    </>
  );
}
