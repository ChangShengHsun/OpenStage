import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useT } from '../i18n';
import { GUIDE } from './guideContent';

/**
 * Usage guide, opened from the top bar. Content (guideContent.ts) is grouped
 * by the demo stages; each section is a collapsible accordion of features with
 * steps, a tip, and an optional screenshot. Content is Traditional Chinese by
 * choice; only the button/title follow the app language.
 */
export function GuideDialog(): ReactElement {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Only mount the content while open: a closed <dialog>'s text still matches
  // page-wide text queries (and could overlap), so keep it out of the DOM.
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        aria-label={t.guide.openAria}
        title={t.guide.openAria}
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        {t.guide.open}
      </button>
      <dialog
        ref={dialogRef}
        className="guide-dialog"
        aria-label={t.guide.title}
        onClose={() => setOpen(false)}
      >
        {open && (
          <>
        <div className="export-dialog-head">
          <span className="panel-title" style={{ margin: 0 }}>
            {t.guide.title}
          </span>
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            {t.guide.close}
          </button>
        </div>
        <div className="guide-body">
          {GUIDE.map((section, i) => (
            <details key={section.id} className="guide-section" open={i === 0}>
              <summary>{section.title}</summary>
              {section.intro !== undefined && <p className="guide-intro">{section.intro}</p>}
              {section.demo !== undefined && (
                <p className="guide-demo">▶ 跟著做：從 Library 開啟範例「{section.demo}」</p>
              )}
              {section.features.map((f) => (
                <div key={f.title} className="guide-feature">
                  <h4>{f.title}</h4>
                  {f.body.map((line, li) => (
                    <p key={li}>{line}</p>
                  ))}
                  {f.tip !== undefined && <p className="guide-tip">💡 {f.tip}</p>}
                  {f.shot !== undefined && (
                    <img
                      className="guide-shot"
                      src={`/guide/${f.shot}`}
                      alt={f.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              ))}
            </details>
          ))}
        </div>
          </>
        )}
      </dialog>
    </>
  );
}
