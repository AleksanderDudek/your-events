import { shiftDateString, utcMidnight } from '@/lib/calendar/warsawTime';
import {
  DATE_RE,
  defaultDaysOf,
  parseStoredPlan,
  PLAN_HORIZON_DAYS,
  PlanSettings,
  sanitizeStoredPlan,
  settingsForDays,
  weekdayOf,
} from '@/lib/weekPlan';

// "Twoje plany": several week plans per city instead of one. Each is a
// 7-day window with the same settings and decisions a single plan always had
// (see weekPlan.ts); this module is the list around them — which weeks can be
// planned, how a plan is stored, read back, migrated and named. Pure, like
// weekPlan.ts: storage and React live in the view.

// ── Weeks ────────────────────────────────────────────────────────────────────

/** How many weeks after this one a new plan can be for. */
export const WEEKS_AHEAD = 3;

/** The Monday of `date`'s week (Polish weeks run Monday to Sunday). */
export function mondayOf(date: string): string {
  return shiftDateString(date, -((weekdayOf(date) + 6) % 7));
}

/** The 7 days of a plan starting on `start`. */
export function windowDates(start: string): string[] {
  return Array.from({ length: PLAN_HORIZON_DAYS }, (_, i) => shiftDateString(start, i));
}

export function windowEnd(start: string): string {
  return shiftDateString(start, PLAN_HORIZON_DAYS - 1);
}

/** The days of a plan that can still be planned: today and after. */
export function openDates(start: string, today: string): string[] {
  return windowDates(start).filter((date) => date >= today);
}

/** Whole weeks between today's week and `date`'s: 0 this week, 1 the next. */
export function weeksFromNow(date: string, today: string): number {
  const days =
    (utcMidnight(mondayOf(date)).getTime() - utcMidnight(mondayOf(today)).getTime()) / 86_400_000;
  return Math.round(days / 7);
}

export interface WeekOption {
  /** Monday of the week. */
  start: string;
  weeksAhead: number;
  /** Its days from today on. */
  dates: string[];
}

/** The weeks a new plan can be for: this one (what is left of it) and the next few. */
export function weekOptions(today: string): WeekOption[] {
  const monday = mondayOf(today);
  return Array.from({ length: WEEKS_AHEAD + 1 }, (_, weeksAhead) => {
    const start = shiftDateString(monday, weeksAhead * 7);
    return { start, weeksAhead, dates: openDates(start, today) };
  });
}

// ── Plans ────────────────────────────────────────────────────────────────────

export type PlanOrigin = 'own' | 'copy';

export interface SavedPlan {
  id: string;
  /** A name the visitor gave it; null means "named after its week". */
  name: string | null;
  /** First day of its 7-day window. */
  start: string;
  origin: PlanOrigin;
  /** For a copy: the shared ids it was made from, to spot copying the same link twice. */
  sourceKey: string | null;
  createdAt: number;
  settings: PlanSettings;
  chosen: Record<string, string>;
}

export const MAX_PLAN_NAME = 60;

const ID_RE = /^[a-z0-9]{4,16}$/;

/** A short id for the URL (`?id=k3x9q2ab`). */
export function newPlanId(rng: () => number = Math.random): string {
  let id = '';
  while (id.length < 8) id += Math.floor(rng() * 36).toString(36);
  return id;
}

export function isPlanId(value: string | null): value is string {
  return value !== null && ID_RE.test(value);
}

/** An empty plan for the week starting on `start`: the default days still ahead, nothing chosen. */
export function createPlan(id: string, start: string, today: string, now: number): SavedPlan {
  return {
    id,
    name: null,
    start,
    origin: 'own',
    sourceKey: null,
    createdAt: now,
    settings: settingsForDays(defaultDaysOf(openDates(start, today))),
    chosen: {},
  };
}

/** The same shared plan, whatever order its ids came in. */
export function copySourceKey(eventIds: readonly string[]): string {
  return [...eventIds].sort((a, b) => a.localeCompare(b)).join('.');
}

export function cleanPlanName(name: string): string | null {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAN_NAME);
  return trimmed === '' ? null : trimmed;
}

/** In list order: by week, then oldest first. */
export function sortPlans(plans: readonly SavedPlan[]): SavedPlan[] {
  return [...plans].sort((a, b) => a.start.localeCompare(b.start) || a.createdAt - b.createdAt);
}

// ── Storage ──────────────────────────────────────────────────────────────────

const STORE_VERSION = 2;

interface PlansFile {
  version: typeof STORE_VERSION;
  plans: SavedPlan[];
}

export function serializePlans(plans: readonly SavedPlan[]): string {
  const file: PlansFile = { version: STORE_VERSION, plans: [...plans] };
  return JSON.stringify(file);
}

/**
 * The stored list, kept to what is still usable: a plan whose week has ended
 * is dropped, past days fall out of the others (with their choices), and
 * anything malformed is skipped rather than failing the whole list.
 */
export function parsePlans(raw: string | null, today: string): SavedPlan[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (data as Partial<PlansFile> | null)?.plans;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const plans: SavedPlan[] = [];
  for (const item of list) {
    const plan = parsePlan(item, today);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    plans.push(plan);
  }
  return sortPlans(plans);
}

function parsePlan(item: unknown, today: string): SavedPlan | null {
  if (!item || typeof item !== 'object') return null;
  const { id, name, start, origin, sourceKey, createdAt } = item as Partial<SavedPlan>;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (typeof start !== 'string' || !DATE_RE.test(start) || windowEnd(start) < today) return null;
  const stored = sanitizeStoredPlan(item, openDates(start, today));
  if (!stored) return null;
  return {
    id,
    name: typeof name === 'string' ? cleanPlanName(name) : null,
    start,
    origin: origin === 'copy' ? 'copy' : 'own',
    sourceKey: typeof sourceKey === 'string' && /^[\d.]{1,400}$/.test(sourceKey) ? sourceKey : null,
    createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0,
    settings: stored.settings,
    chosen: stored.chosen,
  };
}

/**
 * The one plan kept before there were several (`go-to-city.week-plan.{city}`),
 * as the first entry of the list: a window from its first day still ahead,
 * which covers all of it — its days were within 7 days of when it was made.
 */
export function migrateLegacyPlan(
  raw: string | null,
  today: string,
  id: string,
  now: number
): SavedPlan | null {
  const stored = parseStoredPlan(raw, today);
  if (!stored) return null;
  const start = stored.settings.days.map((d) => d.date).sort((a, b) => a.localeCompare(b))[0];
  return { id, name: null, start, origin: 'own', sourceKey: null, createdAt: now, ...stored };
}
