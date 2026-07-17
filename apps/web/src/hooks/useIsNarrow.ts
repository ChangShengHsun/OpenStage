import { useSyncExternalStore } from 'react';

/**
 * True on phone-sized viewports. The breakpoint must match the
 * `@media (max-width: 760px)` rules in index.css — App.tsx stops setting
 * inline grid styles below it so those CSS rules can take over.
 */
export const NARROW_QUERY = '(max-width: 760px)';

let media: MediaQueryList | null = null;
function getMedia(): MediaQueryList {
  if (media === null) media = window.matchMedia(NARROW_QUERY);
  return media;
}

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = getMedia();
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => getMedia().matches,
  );
}
