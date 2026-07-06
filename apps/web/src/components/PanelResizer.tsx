import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { useLayout } from '../state/layout';
import { useT } from '../i18n';

/**
 * IDE-style drag handle overlaid on a sidebar's inner edge (rendered by App
 * over the grid — the panels themselves scroll, so a handle inside them
 * would scroll away). The cast panel starts at the window's left edge and
 * the properties panel ends at its right edge, so the pointer's x maps
 * straight to the new width.
 */
export function PanelResizer({ side }: { side: 'cast' | 'props' }): ReactElement {
  const t = useT();
  const width = useLayout((s) => (side === 'cast' ? s.castWidth : s.propsWidth));
  const setCastWidth = useLayout((s) => s.setCastWidth);
  const setPropsWidth = useLayout((s) => s.setPropsWidth);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (side === 'cast') setCastWidth(e.clientX);
    else setPropsWidth(window.innerWidth - e.clientX);
  };

  return (
    <div
      className="panel-resize"
      style={side === 'cast' ? { left: width - 3 } : { right: width - 3 }}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'cast' ? t.layout.resizeCast : t.layout.resizeProps}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={onPointerMove}
    />
  );
}
