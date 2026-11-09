import { Event } from '@/types/event.types';
import { shiftDateString, utcMidnight } from '@/lib/calendar/warsawTime';
import { distanceMeters } from '@/lib/geo';

// "Twój tydzień": the visitor picks a few days, and each day's slots are filled
// from a short, weighted-random shortlist they can skip through. Everything in
// this module is pure — the data read lives in eventsApi (fetchPlanCandidates),
// storage and React in WeekPlanView — so the rules that decide what gets
// proposed are tested exactly, with an injected random source.
//
// Why the weighting is not optional: a typical week in one city is ~1100 rows,
// and three quarters of them are routine — 486 cinema screenings, 265 gym
// classes, 100 dance classes (Szczecin, 9-15.11.2026). A uniform draw would
// propose "Pilates 8:00" and the fourth screening of the same film. Series are
// folded to one candidate per day and routine categories weigh little unless
// the visitor asks for them.

// ── Days ─────────────────────────────────────────────────────────────────────

/**
 * How far ahead a plan reaches. The events table holds a rolling week (plus
 * seasonal events further out), so a day past this would always come up empty.
 */
export const PLAN_HORIZON_DAYS = 7;

/** The days a plan can cover, today first. */
export function planDates(today: string): string[] {
  return Array.from({ length: PLAN_HORIZON_DAYS }, (_, i) => shiftDateString(today, i));
}

/** JS Date#getDay() for a `YYYY-MM-DD` string — 0 is Sunday. */
export function weekdayOf(date: string): number {
  return utcMidnight(date).getUTCDay();
}

// Monday, Wednesday, Friday, Sunday: a rhythm with a weekend in it, and every
// weekday occurs exactly once in a 7-day window, so all four are always there.
const DEFAULT_WEEKDAYS = new Set([1, 3, 5, 0]);

export function defaultPlanDates(today: string): string[] {
  return planDates(today).filter((date) => DEFAULT_WEEKDAYS.has(weekdayOf(date)));
}

// ── Time of day ──────────────────────────────────────────────────────────────

export type DayPart = 'any' | 'morning' | 'afternoon' | 'evening';
export const DAY_PARTS: readonly DayPart[] = ['any', 'morning', 'afternoon', 'evening'];

/** The part of the day a start time falls in; null when the event has no time. */
export function dayPartOf(startTime: string): Exclude<DayPart, 'any'> | null {
  const match = /^(\d{2}):/.exec(startTime);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * An event without a start time (an exhibition open all day, a fair) fits any
 * part: the visitor picks when to go.
 */
export function fitsDayPart(event: Event, part: DayPart): boolean {
  if (part === 'any') return true;
  const own = dayPartOf(event.startTime);
  return own === null || own === part;
}

// ── Moods ────────────────────────────────────────────────────────────────────

export type Mood = 'culture' | 'music' | 'party' | 'active' | 'kids' | 'learn';
export const MOODS: readonly Mood[] = ['culture', 'music', 'party', 'active', 'kids', 'learn'];

// Moods map onto the pipeline's top-level categories (category_main holds their
// Polish display names). "kids" also reads the audience tag, which marks family
// events filed under music or theatre.
const MOOD_CATEGORIES: Record<Mood, readonly string[]> = {
  culture: ['Teatr i Widowiska', 'Sztuka i Wystawy', 'Literatura', 'Film'],
  music: ['Muzyka'],
  party: ['Imprezy i Rozrywka'],
  active: ['Sport i Fitness', 'Taniec', 'Wellness i Duchowość'],
  kids: ['Dla Dzieci'],
  learn: ['Warsztaty', 'Edukacja'],
};

/**
 * Classes, not evenings out: gym, dance school and yoga schedules. They are a
 * third of a week's rows and, drawn alongside concerts, every shortlist ended
 * up with a "ZUMBA 19:00" on it (first real run, 9.11.2026). Left out — not
 * fetched at all — unless the visitor picks "Aktywnie".
 */
export const ROUTINE_CATEGORIES: readonly string[] = ['Sport i Fitness', 'Taniec', 'Wellness i Duchowość'];

export function wantsRoutine(moods: readonly Mood[]): boolean {
  return moods.includes('active');
}

// With no mood picked, how likely each category is to be proposed. Screenings
// are not excluded — a film night is a fine plan — they just must not crowd out
// the one-off evenings the plan is for. (Classes are out altogether, above.)
const DEFAULT_CATEGORY_WEIGHT: Record<string, number> = {
  Muzyka: 1,
  'Teatr i Widowiska': 1,
  'Imprezy i Rozrywka': 1,
  'Sztuka i Wystawy': 0.9,
  Warsztaty: 0.8,
  Literatura: 0.7,
  Zwierzęta: 0.5,
  Edukacja: 0.5,
  Inne: 0.5,
  'Dla Dzieci': 0.4,
  Film: 0.35,
};
const UNKNOWN_CATEGORY_WEIGHT = 0.5;

// ── Candidates ───────────────────────────────────────────────────────────────

/** An event plus the pipeline's enrichment columns the weighting reads. */
export interface PlanCandidate {
  event: Event;
  /** How many sources listed it (1 = one). */
  popularity: number;
  /** photo / poster / logo / placeholder / unknown — a real picture sells a plan. */
  imageKind: string | null;
  seasons: string[];
  audience: string[];
  isLastDay: boolean;
  soldOut: boolean;
}

function matchesMoods(candidate: PlanCandidate, moods: readonly Mood[]): boolean {
  if (moods.length === 0) return true;
  return moods.some(
    (mood) =>
      MOOD_CATEGORIES[mood].includes(candidate.event.categoryMain) ||
      (mood === 'kids' && candidate.audience.some((a) => a === 'dzieci' || a === 'rodziny'))
  );
}

export function isFree(event: Event): boolean {
  return event.price.amount === 0;
}

/**
 * One screening of a film, one session of a class: name and venue, any time.
 * A film is one series across cinemas — the same title at Helios and at
 * Multikino is one evening out, not two proposals.
 */
export function seriesKey(event: Event): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return event.categoryMain === 'Film' ? `film|${norm(event.name)}` : `${norm(event.name)}|${norm(event.location.name)}`;
}

/** How likely a candidate is to be drawn, before the day's context. */
export function baseWeight(candidate: PlanCandidate, moods: readonly Mood[]): number {
  // A chosen mood is the visitor's own ask, so its categories stop being
  // "routine" — with "active" on, a gym class weighs as much as a concert.
  let weight =
    moods.length > 0
      ? 1
      : (DEFAULT_CATEGORY_WEIGHT[candidate.event.categoryMain] ?? UNKNOWN_CATEGORY_WEIGHT);
  if (candidate.imageKind === 'photo' || candidate.imageKind === 'poster') weight *= 1.5;
  else if (candidate.imageKind === 'logo' || candidate.imageKind === 'placeholder') weight *= 0.7;
  weight *= 1 + 0.4 * Math.min(Math.max(candidate.popularity - 1, 0), 5);
  if (candidate.seasons.length > 0) weight *= 1.5;
  if (candidate.isLastDay) weight *= 1.3;
  return weight;
}

// ── Settings and slots ───────────────────────────────────────────────────────

export const MAX_SLOTS_PER_DAY = 3;

export interface DaySettings {
  date: string;
  /** One entry per slot: how many events this day gets, and when each one is. */
  parts: DayPart[];
}

export interface PlanSettings {
  days: DaySettings[];
  moods: Mood[];
  freeOnly: boolean;
}

export function defaultSettings(today: string): PlanSettings {
  return {
    days: defaultPlanDates(today).map((date) => ({ date, parts: ['any'] })),
    moods: [],
    freeOnly: false,
  };
}

export interface PlanSlot {
  id: string;
  date: string;
  part: DayPart;
}

export function slotId(date: string, index: number): string {
  return `${date}#${index}`;
}

export function planSlots(settings: PlanSettings): PlanSlot[] {
  return [...settings.days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((day) => day.parts.map((part, i) => ({ id: slotId(day.date, i), date: day.date, part })));
}

// Schedules mark a cancelled session in its name ("ODWOŁANE: LOFT MINI CHAMP")
// rather than dropping it; a plan must never propose one.
const CANCELLED_RE = /^\s*(?:odwołan[ey]|odwolan[ey]|cancell?ed)\b/i;

export function isCancelled(event: Event): boolean {
  return CANCELLED_RE.test(event.name);
}

/** Every candidate a slot may take, one per series (the first that fits). */
export function slotPool(
  candidates: readonly PlanCandidate[],
  slot: PlanSlot,
  settings: Pick<PlanSettings, 'moods' | 'freeOnly'>
): PlanCandidate[] {
  const bySeries = new Map<string, PlanCandidate>();
  for (const candidate of candidates) {
    const { event } = candidate;
    if (event.date !== slot.date || candidate.soldOut || isCancelled(event)) continue;
    if (!wantsRoutine(settings.moods) && ROUTINE_CATEGORIES.includes(event.categoryMain)) continue;
    if (!fitsDayPart(event, slot.part)) continue;
    if (!matchesMoods(candidate, settings.moods)) continue;
    if (settings.freeOnly && !isFree(event)) continue;
    const key = seriesKey(event);
    const kept = bySeries.get(key);
    // Earliest session of the series stands in for all of them.
    if (!kept || (event.startTime || '99') < (kept.event.startTime || '99')) {
      bySeries.set(key, candidate);
    }
  }
  return [...bySeries.values()];
}

// ── Drawing ──────────────────────────────────────────────────────────────────

export type Rng = () => number;

/** Up to `count` distinct items, each drawn with probability ∝ its weight. */
export function weightedSample<T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  rng: Rng
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weightOf(item), 0) }));
  const picked: T[] = [];
  while (picked.length < count) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) break;
    let roll = rng() * total;
    const index = pool.findIndex((entry) => {
      roll -= entry.weight;
      return roll < 0;
    });
    // Floating-point leftovers can run past the end; the last weighted entry wins.
    const at = index === -1 ? pool.map((e) => e.weight > 0).lastIndexOf(true) : index;
    picked.push(pool[at].item);
    pool.splice(at, 1);
  }
  return picked;
}

const NEARBY_M = 1500;

function overlaps(a: Event, b: Event): boolean {
  if (!a.startTime || !b.startTime) return false;
  const start = (e: Event) => Number(e.startTime.slice(0, 2)) * 60 + Number(e.startTime.slice(3));
  const length = (e: Event) => e.durationMin ?? 120;
  return start(a) < start(b) + length(b) && start(b) < start(a) + length(a);
}

/**
 * The weight a candidate has for one slot, given what the rest of the plan
 * already holds. Zero excludes: an event (or series) already picked elsewhere,
 * or one that clashes with something chosen the same day. A second event close
 * to the day's first one is favoured — two plans a tram ride apart beat two at
 * opposite ends of the city.
 */
export function contextWeight(
  candidate: PlanCandidate,
  slot: PlanSlot,
  chosenElsewhere: readonly Event[],
  moods: readonly Mood[]
): number {
  const { event } = candidate;
  const key = seriesKey(event);
  let weight = baseWeight(candidate, moods);
  for (const other of chosenElsewhere) {
    if (other.id === event.id || seriesKey(other) === key) return 0;
    if (other.date !== slot.date) continue;
    if (overlaps(other, event)) return 0;
    const a = other.location;
    const b = event.location;
    if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
      if (distanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= NEARBY_M) {
        weight *= 1.5;
      }
    }
  }
  return weight;
}

// ── Plan state ───────────────────────────────────────────────────────────────

export const PROPOSALS_PER_SLOT = 3;

export interface PlanState {
  settings: PlanSettings;
  /** Event ids on offer for each slot that has not been decided yet. */
  proposals: Record<string, string[]>;
  /** The decided slots: slot id → event id. */
  chosen: Record<string, string>;
  /** Ids the visitor skipped, per slot — never offered there again. */
  skipped: Record<string, string[]>;
}

export type PlanAction =
  | { type: 'settings'; settings: PlanSettings }
  | { type: 'reroll'; slotId?: string }
  | { type: 'skip'; slotId: string; eventId: string }
  | { type: 'choose'; slotId: string; eventId: string }
  | { type: 'unchoose'; slotId: string }
  /** Fill every open slot with its first proposal ("Zaskocz mnie"). */
  | { type: 'autofill' }
  /** A new time of day for one slot; its choice and shortlist start over. */
  | { type: 'setPart'; slotId: string; part: DayPart }
  /** A day's extra slot, appended at the end. */
  | { type: 'addSlot'; date: string }
  /** Drop one slot of a day; the day's later slots move up a place. */
  | { type: 'removeSlot'; slotId: string };

export interface PlanContext {
  candidates: ReadonlyMap<string, PlanCandidate>;
  rng: Rng;
}

export function emptyPlan(settings: PlanSettings): PlanState {
  return { settings, proposals: {}, chosen: {}, skipped: {} };
}

function chosenEvents(state: PlanState, ctx: PlanContext, except?: string): Event[] {
  return Object.entries(state.chosen)
    .filter(([id]) => id !== except)
    .flatMap(([, eventId]) => {
      const candidate = ctx.candidates.get(eventId);
      return candidate ? [candidate.event] : [];
    });
}

// A second card of a category already on screen is this much less likely.
const REPEAT_CATEGORY_FACTOR = 0.2;

/**
 * Up to `count` proposals from `pool`, spread across categories.
 *
 * A single screening weighs little, but a day has thirty different films and
 * three concerts — summed, cinema would still fill the shortlist (2 of 3 cards
 * on the first real run). Each item's weight is divided by √(size of its
 * category in the pool), so a category's total pull grows with √n rather
 * than n, and a category already showing is damped for the next card.
 */
export function diverseSample(
  pool: readonly PlanCandidate[],
  count: number,
  weightOf: (c: PlanCandidate) => number,
  rng: Rng,
  showing: readonly PlanCandidate[] = []
): PlanCandidate[] {
  const size = new Map<string, number>();
  for (const c of pool) size.set(c.event.categoryMain, (size.get(c.event.categoryMain) ?? 0) + 1);
  const shown = new Set(showing.map((c) => c.event.categoryMain));
  const picked: PlanCandidate[] = [];
  let rest = [...pool];
  while (picked.length < count) {
    const [next] = weightedSample(
      rest,
      1,
      (c) =>
        (weightOf(c) / Math.sqrt(size.get(c.event.categoryMain) ?? 1)) *
        (shown.has(c.event.categoryMain) ? REPEAT_CATEGORY_FACTOR : 1),
      rng
    );
    if (!next) break;
    picked.push(next);
    shown.add(next.event.categoryMain);
    rest = rest.filter((c) => c !== next);
  }
  return picked;
}

/** `count` fresh proposals for a slot, none of `exclude`. */
function draw(
  state: PlanState,
  ctx: PlanContext,
  slot: PlanSlot,
  count: number,
  exclude: ReadonlySet<string>,
  showing: readonly string[] = []
): string[] {
  const pool = slotPool([...ctx.candidates.values()], slot, state.settings).filter(
    (c) => !exclude.has(c.event.id)
  );
  const elsewhere = chosenEvents(state, ctx, slot.id);
  // Proposals already showing in other undecided slots are not repeated either:
  // the same concert on Monday's and Wednesday's shortlist reads as a glitch.
  const offeredElsewhere = new Set(
    Object.entries(state.proposals)
      .filter(([id]) => id !== slot.id)
      .flatMap(([, ids]) => ids)
  );
  return diverseSample(
    pool,
    count,
    (c) =>
      offeredElsewhere.has(c.event.id) ? 0 : contextWeight(c, slot, elsewhere, state.settings.moods),
    ctx.rng,
    showing.flatMap((id) => {
      const c = ctx.candidates.get(id);
      return c ? [c] : [];
    })
  ).map((c) => c.event.id);
}

function fillSlots(state: PlanState, ctx: PlanContext, only?: string): PlanState {
  const next: PlanState = { ...state, proposals: { ...state.proposals } };
  for (const slot of planSlots(state.settings)) {
    if (next.chosen[slot.id]) continue;
    if (only !== undefined && slot.id !== only) continue;
    next.proposals[slot.id] = draw(
      next,
      ctx,
      slot,
      PROPOSALS_PER_SLOT,
      new Set(next.skipped[slot.id] ?? [])
    );
  }
  return next;
}

/** Drops whatever belongs to a slot the settings no longer have. */
function pruneToSettings(state: PlanState): PlanState {
  const live = new Set(planSlots(state.settings).map((s) => s.id));
  const keep = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => live.has(id)));
  return {
    ...state,
    proposals: keep(state.proposals),
    chosen: keep(state.chosen),
    skipped: keep(state.skipped),
  };
}

export function planReducer(state: PlanState, action: PlanAction, ctx: PlanContext): PlanState {
  switch (action.type) {
    case 'settings': {
      // A changed time of day or mood invalidates a slot's shortlist but not a
      // choice already made: the visitor decided on that event, keep it.
      const pruned = pruneToSettings({ ...state, settings: action.settings, proposals: {} });
      return fillSlots(pruned, ctx);
    }
    case 'reroll': {
      // "Something else": everything currently offered is set aside too, so a
      // reroll never shows the same three again.
      const ids = action.slotId ? [action.slotId] : Object.keys(state.proposals);
      const skipped = { ...state.skipped };
      for (const id of ids) {
        skipped[id] = [...(skipped[id] ?? []), ...(state.proposals[id] ?? [])];
      }
      const cleared = { ...state, skipped, proposals: { ...state.proposals } };
      for (const id of ids) delete cleared.proposals[id];
      return action.slotId ? fillSlots(cleared, ctx, action.slotId) : fillSlots(cleared, ctx);
    }
    case 'skip': {
      const current = state.proposals[action.slotId] ?? [];
      if (!current.includes(action.eventId)) return state;
      const slot = planSlots(state.settings).find((s) => s.id === action.slotId);
      if (!slot) return state;
      const skipped = {
        ...state.skipped,
        [action.slotId]: [...(state.skipped[action.slotId] ?? []), action.eventId],
      };
      const exclude = new Set([...skipped[action.slotId], ...current]);
      const withSkip = { ...state, skipped };
      const staying = current.filter((id) => id !== action.eventId);
      const [replacement] = draw(withSkip, ctx, slot, 1, exclude, staying);
      // The replacement takes the skipped card's place, so the other two stay put.
      const proposals = current.flatMap((id) =>
        id !== action.eventId ? [id] : replacement ? [replacement] : []
      );
      return { ...withSkip, proposals: { ...state.proposals, [action.slotId]: proposals } };
    }
    case 'choose': {
      if (!ctx.candidates.has(action.eventId)) return state;
      const proposals = { ...state.proposals };
      delete proposals[action.slotId];
      const next = { ...state, proposals, chosen: { ...state.chosen, [action.slotId]: action.eventId } };
      // A choice can make another slot's offer stale (same event, a clash the
      // same day), so the open slots are drawn again around it.
      return refreshConflicts(next, ctx);
    }
    case 'unchoose': {
      const chosen = { ...state.chosen };
      delete chosen[action.slotId];
      return fillSlots({ ...state, chosen }, ctx, action.slotId);
    }
    case 'autofill': {
      let next = state;
      for (const slot of planSlots(state.settings)) {
        const first = next.proposals[slot.id]?.[0];
        if (!next.chosen[slot.id] && first) {
          next = planReducer(next, { type: 'choose', slotId: slot.id, eventId: first }, ctx);
        }
      }
      return next;
    }
    case 'setPart': {
      const [date, index] = splitSlotId(action.slotId);
      const days = state.settings.days.map((d) =>
        d.date === date ? { ...d, parts: d.parts.map((p, i) => (i === index ? action.part : p)) } : d
      );
      const cleared = withoutSlot(state, action.slotId);
      return fillSlots({ ...cleared, settings: { ...state.settings, days } }, ctx, action.slotId);
    }
    case 'addSlot': {
      const day = state.settings.days.find((d) => d.date === action.date);
      if (!day || day.parts.length >= MAX_SLOTS_PER_DAY) return state;
      const days = state.settings.days.map((d) =>
        d.date === action.date ? { ...d, parts: [...d.parts, 'any' as DayPart] } : d
      );
      return fillSlots(
        { ...state, settings: { ...state.settings, days } },
        ctx,
        slotId(action.date, day.parts.length)
      );
    }
    case 'removeSlot': {
      const [date, index] = splitSlotId(action.slotId);
      const day = state.settings.days.find((d) => d.date === date);
      if (!day) return state;
      // The last slot of a day takes the day with it.
      const days =
        day.parts.length === 1
          ? state.settings.days.filter((d) => d.date !== date)
          : state.settings.days.map((d) =>
              d.date === date ? { ...d, parts: d.parts.filter((_, i) => i !== index) } : d
            );
      // Slot ids are positional, so everything after the removed one moves up.
      const shift = <T,>(record: Record<string, T>) =>
        Object.fromEntries(
          Object.entries(record).flatMap(([id, value]) => {
            const [d, i] = splitSlotId(id);
            if (d !== date) return [[id, value]];
            if (i === index) return [];
            return [[slotId(d, i > index ? i - 1 : i), value]];
          })
        );
      return {
        settings: { ...state.settings, days },
        proposals: shift(state.proposals),
        chosen: shift(state.chosen),
        skipped: shift(state.skipped),
      };
    }
  }
}

function splitSlotId(id: string): [string, number] {
  const [date, index] = id.split('#');
  return [date, Number(index)];
}

function withoutSlot(state: PlanState, id: string): PlanState {
  const drop = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
  return { ...state, proposals: drop(state.proposals), chosen: drop(state.chosen), skipped: drop(state.skipped) };
}

/** Replaces open proposals that the plan's choices have ruled out. */
function refreshConflicts(state: PlanState, ctx: PlanContext): PlanState {
  let next = state;
  for (const slot of planSlots(state.settings)) {
    const offered = next.proposals[slot.id];
    if (!offered || next.chosen[slot.id]) continue;
    const elsewhere = chosenEvents(next, ctx, slot.id);
    const stillFine = offered.filter((id) => {
      const candidate = ctx.candidates.get(id);
      return candidate && contextWeight(candidate, slot, elsewhere, next.settings.moods) > 0;
    });
    if (stillFine.length === offered.length) continue;
    const exclude = new Set([...(next.skipped[slot.id] ?? []), ...stillFine]);
    const topUp = draw(
      { ...next, proposals: { ...next.proposals, [slot.id]: stillFine } },
      ctx,
      slot,
      PROPOSALS_PER_SLOT - stillFine.length,
      exclude,
      stillFine
    );
    next = { ...next, proposals: { ...next.proposals, [slot.id]: [...stillFine, ...topUp] } };
  }
  return next;
}

/** The chosen events in plan order (by day, then slot). */
export function chosenInOrder(state: PlanState, candidates: ReadonlyMap<string, PlanCandidate>): Event[] {
  return planSlots(state.settings).flatMap((slot) => {
    const id = state.chosen[slot.id];
    const candidate = id ? candidates.get(id) : undefined;
    return candidate ? [candidate.event] : [];
  });
}

// ── Storage and sharing ──────────────────────────────────────────────────────

/** What survives a reload: the settings and the decisions, not the shortlists. */
export interface StoredPlan {
  settings: PlanSettings;
  chosen: Record<string, string>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A stored plan, or null when there is nothing usable. Days that have passed
 * are dropped (with their choices); a plan left with no day falls back to null
 * so the caller starts a fresh one.
 */
export function parseStoredPlan(raw: string | null, today: string): StoredPlan | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { settings, chosen } = data as Partial<StoredPlan>;
  if (!settings || !Array.isArray(settings.days)) return null;
  const window = new Set(planDates(today));
  const days: DaySettings[] = settings.days.flatMap((day) => {
    if (!day || typeof day.date !== 'string' || !DATE_RE.test(day.date) || !window.has(day.date)) {
      return [];
    }
    const parts = Array.isArray(day.parts)
      ? day.parts.filter((p): p is DayPart => DAY_PARTS.includes(p as DayPart)).slice(0, MAX_SLOTS_PER_DAY)
      : [];
    return parts.length > 0 ? [{ date: day.date, parts }] : [];
  });
  if (days.length === 0) return null;
  const moods = Array.isArray(settings.moods)
    ? settings.moods.filter((m): m is Mood => MOODS.includes(m as Mood))
    : [];
  const clean: PlanSettings = { days, moods, freeOnly: settings.freeOnly === true };
  const live = new Set(planSlots(clean).map((s) => s.id));
  const keptChoices =
    chosen && typeof chosen === 'object'
      ? Object.fromEntries(
          Object.entries(chosen).filter(
            ([id, eventId]) => live.has(id) && typeof eventId === 'string' && /^\d+$/.test(eventId)
          )
        )
      : {};
  return { settings: clean, chosen: keptChoices };
}

/** Longest plan a link carries: every slot of every day of the horizon. */
export const MAX_SHARED_EVENTS = PLAN_HORIZON_DAYS * MAX_SLOTS_PER_DAY;

/** Event ids for a share link: `?plan=12.345.678`. */
export function encodePlanParam(eventIds: readonly string[]): string {
  return eventIds.join('.');
}

export function decodePlanParam(param: string | null): string[] {
  if (!param) return [];
  const ids = param.split('.').filter((id) => /^\d{1,12}$/.test(id));
  return [...new Set(ids)].slice(0, MAX_SHARED_EVENTS);
}

// ── Cost ─────────────────────────────────────────────────────────────────────

/**
 * Prices above this are scraped noise (a ticket id read as a price), not a
 * night out — the list's isRealisticPrice draws the same line.
 */
const MAX_PLAUSIBLE_PRICE = 2000;

export interface PlanCost {
  /** Sum of the known prices, per person. */
  total: number;
  /** Events counted in `total` with a price above zero. */
  paid: number;
  free: number;
  /** No usable price: none given, a membership label, or an implausible one. */
  unknown: number;
}

/**
 * What the plan costs one person. A membership label ("Karnet od 149 zł") is
 * not the price of one visit, so it counts as unknown rather than as 149.
 */
export function planCost(events: readonly Event[]): PlanCost {
  const cost: PlanCost = { total: 0, paid: 0, free: 0, unknown: 0 };
  for (const { price } of events) {
    const amount = price.amount;
    if (price.showLabel || amount === null || amount < 0 || amount > MAX_PLAUSIBLE_PRICE) {
      cost.unknown += 1;
    } else if (amount === 0) {
      cost.free += 1;
    } else {
      cost.total += amount;
      cost.paid += 1;
    }
  }
  return cost;
}
