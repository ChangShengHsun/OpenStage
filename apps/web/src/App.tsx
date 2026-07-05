import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">
          Open<em>Stage</em>
        </span>
        <span className="topbar-spacer" />
      </header>
      <aside className="cast-panel side-panel">
        <div className="panel-title">Cast</div>
        <p className="empty-note">No performers yet.</p>
      </aside>
      <main className="stage-area" aria-label="Stage canvas" />
      <aside className="props-panel side-panel">
        <div className="panel-title">Properties</div>
        <p className="empty-note">Nothing selected.</p>
      </aside>
      <section className="timeline-panel" aria-label="Timeline">
        <div className="timeline-toolbar">
          <span className="panel-title" style={{ padding: 0 }}>
            Timeline
          </span>
        </div>
        <div className="timeline-body" />
      </section>
    </div>
  );
}
