import type { Messages } from '@/i18n';
import { isOwnFix } from '@/components/service/useGeolocation';
import type { NearFilter } from '@/types/filter.types';

/**
 * What to call a proximity filter's point: its address when it has one; "your
 * location" when it is this tab's own fix; otherwise "selected point" — which
 * is what someone else's location, arriving by a shared link, must be called.
 */
export function nearPlaceName(near: NearFilter, t: Messages): string {
  if (near.label) return near.label;
  return isOwnFix(near) ? t.NEAR_MY_LOCATION : t.NEAR_PICKED_POINT;
}
