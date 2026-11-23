import type { Messages } from '@/i18n/messages';
import { formatDateShort } from '@/lib/utils';
import { SavedPlan, weeksFromNow, windowEnd } from '@/lib/weekPlans';

type LabelMessages = Pick<
  Messages,
  'WEEK_PLAN_NAME_THIS' | 'WEEK_PLAN_NAME_NEXT' | 'WEEK_PLAN_NAME_AHEAD' | 'WEEK_PLAN_NAME_COPY'
>;

/** "Ten tydzień", "Przyszły tydzień", "Za 2 tygodnie" — true on whichever day it is read. */
export function weekName(t: LabelMessages, start: string, today: string): string {
  const weeks = weeksFromNow(start, today);
  if (weeks <= 0) return t.WEEK_PLAN_NAME_THIS;
  return weeks === 1 ? t.WEEK_PLAN_NAME_NEXT : t.WEEK_PLAN_NAME_AHEAD(weeks);
}

/** The visitor's name for a plan, or one made from its week (a copy is "Plan od znajomych"). */
export function planTitle(t: LabelMessages, plan: SavedPlan, today: string): string {
  if (plan.name) return plan.name;
  return plan.origin === 'copy' ? t.WEEK_PLAN_NAME_COPY : weekName(t, plan.start, today);
}

/** "23 lis – 29 lis". */
export function planRange(start: string, locale: string): string {
  return `${formatDateShort(start, locale)} – ${formatDateShort(windowEnd(start), locale)}`;
}
