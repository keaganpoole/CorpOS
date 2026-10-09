import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';
export const TOUCH_LAYOUT_QUERY = '(max-width: 1023px)';

// Subscribe to breakpoints, not every resize pixel. Existing desktop views keep
// their own page-specific breakpoints (including the Calendar split view).
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function useDashboardViewport() {
  return { isPhone: useMediaQuery(PHONE_QUERY), isCompact: useMediaQuery(TOUCH_LAYOUT_QUERY) };
}
