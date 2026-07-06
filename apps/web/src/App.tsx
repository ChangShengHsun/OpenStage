import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { startCollab } from './collab/collab';
import { isViewMode } from './state/viewMode';

// three.js is heavy — load it only when someone opens the 3D preview.
const Stage3D = lazy(() => import('./components/Stage3D'));
import { TopBar } from './components/TopBar';
import { CastPanel } from './components/CastPanel';
import { StageCanvas } from './components/StageCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Timeline } from './components/Timeline';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import { usePlayback } from './hooks/usePlayback';
import { clearAudio, loadPersistedAudio, setAudioBlob } from './audio/audioPlayer';

export function App(): ReactElement {
  const { togglePlay } = usePlayback();
  useAppHotkeys(togglePlay);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioVersion, setAudioVersion] = useState(0);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    void loadPersistedAudio().then((loaded) => {
      if (loaded) setAudioVersion((v) => v + 1);
    });
    const room = new URLSearchParams(window.location.search).get('room');
    if (room !== null && room !== '') startCollab(room);
  }, []);

  return (
    <div className={`app${isViewMode ? ' view-mode' : ''}`}>
      <TopBar
        onTogglePlay={togglePlay}
        onExportPdf={() => {
          // Implemented in the PDF export milestone.
          void import('./export/pdf').then((m) => m.exportPerformancePdf());
        }}
      />
      <CastPanel />
      <main className="stage-area" aria-label="Stage canvas">
        {show3d ? (
          <Suspense fallback={<p className="empty-note">Loading 3D preview…</p>}>
            <Stage3D />
          </Suspense>
        ) : (
          <StageCanvas />
        )}
        <button
          type="button"
          className="btn view-toggle"
          onClick={() => setShow3d((v) => !v)}
          title={show3d ? 'Back to the 2D editor' : '3D preview (view only)'}
        >
          {show3d ? '2D' : '3D'}
        </button>
      </main>
      <PropertiesPanel />
      <Timeline
        audioVersion={audioVersion}
        onUploadAudio={() => fileInputRef.current?.click()}
        onClearAudio={() => {
          void clearAudio().then(() => setAudioVersion((v) => v + 1));
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        aria-label="Audio file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file === undefined) return;
          void setAudioBlob(file).then(() => setAudioVersion((v) => v + 1));
          e.target.value = '';
        }}
      />
    </div>
  );
}
