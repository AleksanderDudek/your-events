'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { stripPushSource } from '@/lib/pushOpen';

/**
 * Counts a visit that came from a reminder (`src=push`) and removes the marker
 * from the URL, so a shared or reloaded link does not count again. Mounted
 * once, in Providers; re-checks on every route change.
 */
export default function PushOpenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const stripped = stripPushSource(window.location.href);
    if (!stripped) return;
    trackEvent('push_open');
    window.history.replaceState(null, '', stripped);
  }, [pathname]);
  return null;
}
