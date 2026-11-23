'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  migrateLegacyPlan,
  newPlanId,
  parsePlans,
  SavedPlan,
  serializePlans,
} from '@/lib/weekPlans';

// The visitor's plans, one list per city, in localStorage. Read through
// useSyncExternalStore so every part of the page sees the same list and a
// change in another tab shows up here too.

export const PLANS_STORAGE_PREFIX = 'go-to-city.week-plans.';
/** Where the single plan lived before there were several. Migrated once, then removed. */
export const LEGACY_PLAN_STORAGE_PREFIX = 'go-to-city.week-plan.';

const CHANGE_EVENT = 'go-to-city:week-plans';

// Private mode, a sandboxed iframe or a full quota: the plans live in memory
// for the visit instead, so creating, copying and switching still work.
const memory = new Map<string, string>();
let storageBroken = false;

function readRaw(key: string): string | null {
  if (!storageBroken) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      storageBroken = true;
    }
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  if (storageBroken) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    storageBroken = true;
  }
}

function migrate(cityId: string, today: string): void {
  const key = PLANS_STORAGE_PREFIX + cityId;
  if (readRaw(key) !== null) return;
  const legacyKey = LEGACY_PLAN_STORAGE_PREFIX + cityId;
  const legacy = readRaw(legacyKey);
  if (legacy === null) return;
  const plan = migrateLegacyPlan(legacy, today, newPlanId(), Date.now());
  writeRaw(key, serializePlans(plan ? [plan] : []));
  try {
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Left behind; the new key wins from now on anyway.
  }
}

// One parsed list per stored string, so the snapshot keeps its identity until
// the storage really changes (useSyncExternalStore re-renders on a new one).
const cache = new Map<string, { raw: string | null; plans: SavedPlan[] }>();

function snapshot(cityId: string, today: string): SavedPlan[] {
  // Idempotent: once the new key exists this is a single read.
  migrate(cityId, today);
  const raw = readRaw(PLANS_STORAGE_PREFIX + cityId);
  const cacheKey = `${cityId}|${today}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.raw === raw) return hit.plans;
  const plans = parsePlans(raw, today);
  cache.set(cacheKey, { raw, plans });
  return plans;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PLANS_STORAGE_PREFIX)) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function write(cityId: string, today: string, update: (plans: SavedPlan[]) => SavedPlan[]): void {
  const next = update(snapshot(cityId, today));
  writeRaw(PLANS_STORAGE_PREFIX + cityId, serializePlans(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface PlansStore {
  /** By week, then oldest first. */
  plans: SavedPlan[];
  /** Adds the plan, or replaces the one with its id. */
  save: (plan: SavedPlan) => void;
  remove: (id: string) => void;
}

const noPlans = () => null;

/**
 * The city's plans, or null until "today" is known (the static HTML has no
 * today and no storage — nothing renders from it before hydration).
 */
export function usePlans(cityId: string, today: string | null): PlansStore | null {
  const plans = useSyncExternalStore(
    subscribe,
    () => (today ? snapshot(cityId, today) : null),
    noPlans
  );
  return useMemo(() => {
    if (!plans || !today) return null;
    return {
      plans,
      save: (plan) =>
        write(cityId, today, (list) =>
          list.some((p) => p.id === plan.id)
            ? list.map((p) => (p.id === plan.id ? plan : p))
            : [...list, plan]
        ),
      remove: (id) => write(cityId, today, (list) => list.filter((p) => p.id !== id)),
    };
  }, [cityId, plans, today]);
}
