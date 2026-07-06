import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sidebar widths, draggable like an IDE and persisted per browser.
 *
 * The DEFAULTS must stay 216 / 248: e2e/editor.spec.ts mirrors the app's
 * layout math (meterToPx) with these numbers, and tests run on a fresh
 * localStorage so they always see the defaults.
 */
export const DEFAULT_CAST_W = 216;
export const DEFAULT_PROPS_W = 248;
const MIN_PANEL_W = 160;
const MAX_PANEL_W = 420;

const clampWidth = (px: number): number => Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, px));

interface LayoutState {
  castWidth: number;
  propsWidth: number;
  setCastWidth: (px: number) => void;
  setPropsWidth: (px: number) => void;
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      castWidth: DEFAULT_CAST_W,
      propsWidth: DEFAULT_PROPS_W,
      setCastWidth: (px) => set({ castWidth: clampWidth(px) }),
      setPropsWidth: (px) => set({ propsWidth: clampWidth(px) }),
    }),
    { name: 'openstage-layout' },
  ),
);
