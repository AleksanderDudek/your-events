'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckIcon from '@mui/icons-material/Check';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';
import ShareIcon from '@mui/icons-material/Share';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CelebrationIcon from '@mui/icons-material/Celebration';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import HandymanIcon from '@mui/icons-material/Handyman';
import SavingsIcon from '@mui/icons-material/Savings';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useCategories } from '@/components/service/useCategories';
import { fetchEventsByIds, fetchPlanCandidates } from '@/components/service/eventsApi';
import { eventsKeys } from '@/components/service/queryKeys';
import { trackEvent } from '@/lib/analytics';
import { withBasePath } from '@/lib/constants';
import { navigateInPage } from '@/lib/inPageNavigation';
import { planCostLabel, planFromEvents, sortPlanEvents } from '@/lib/planShare';
import { toLocalDateString } from '@/lib/dateWindows';
import { shiftDateString } from '@/lib/calendar/warsawTime';
import { formatDateShort } from '@/lib/utils';
import { eventPath } from '@/lib/slug';
import { toCalendarEvent } from '@/lib/calendar/calendarEvent';
import { buildIcsCalendar, icsDataUri } from '@/lib/calendar/ics';
import {
  chosenInOrder,
  DAY_PARTS,
  DayPart,
  decodePlanParam,
  defaultDaysOf,
  emptyPlan,
  MAX_SLOTS_PER_DAY,
  Mood,
  MOODS,
  PlanAction,
  PlanCandidate,
  PlanCost,
  planCost,
  planReducer,
  PlanSettings,
  PlanSlot,
  planSlots,
  PlanState,
  settingsForDays,
  wantsRoutine,
  weekdayOf,
} from '@/lib/weekPlan';
import {
  copySourceKey,
  createPlan,
  isPlanId,
  mondayOf,
  newPlanId,
  openDates,
  SavedPlan,
} from '@/lib/weekPlans';
import { Event } from '@/types/event.types';
import PlanEventCard from './PlanEventCard';
import PlanShareDialog from './PlanShareDialog';
import PlansList, { followInPage, planPath } from './PlansList';
import PlanMenu from './PlanMenu';
import PlanNameDialog from './PlanNameDialog';
import NewPlanDialog from './NewPlanDialog';
import { planRange, planTitle } from './planLabels';
import { PlansStore, usePlans } from './usePlans';
import styles from './WeekPlanView.module.scss';

// Set by "Skopiuj do moich planów" for the planner it hands over to, which
// says "copied" (or "you already had it") once and clears it. Session-scoped:
// a later visit is quiet.
const COPIED_FLAG = 'go-to-city.week-plan.copied';
type CopiedFlag = 'new' | 'again';

function setCopiedFlag(flag: CopiedFlag): void {
  try {
    window.sessionStorage.setItem(COPIED_FLAG, flag);
  } catch {
    // No toast, then — the copy itself is saved.
  }
}

function takeCopiedFlag(): CopiedFlag | null {
  try {
    const flag = window.sessionStorage.getItem(COPIED_FLAG);
    window.sessionStorage.removeItem(COPIED_FLAG);
    // '1' is what a copy made before there were several plans left behind.
    return flag === 'again' ? 'again' : flag === 'new' || flag === '1' ? 'new' : null;
  } catch {
    return null;
  }
}

/** A chosen event the week's read did not bring, read on its own by id. */
function pinnedCandidate(event: Event): PlanCandidate {
  return { event, popularity: 1, imageKind: null, seasons: [], audience: [], isLastDay: false, soldOut: false };
}

function sameSettings(a: PlanSettings, b: PlanSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// "Today" exists only in the visitor's browser: the static HTML is built once
// for every day. Read as an external store so the server snapshot is explicit
// (null — nothing renders until hydration) instead of set from an effect.
const noSubscription = () => () => {};
function useToday(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => toLocalDateString(new Date()),
    () => null
  );
}

/**
 * "Twój tydzień" / "Twoje plany". What the URL says decides what is shown:
 *
 * - `?plan=1.2.3` — someone else's plan, read-only, to copy;
 * - `?id=k3x9q2ab` — one of my plans, in the planner;
 * - nothing, and no plans yet — the planner on a draft for this week, saved
 *   (and given its `?id=`) on its first real change;
 * - nothing, with plans — the list of them.
 *
 * Everything here starts after mount: the page is a static export, and both
 * "today" and the plans only exist in the visitor's browser. Moving between
 * these goes through navigateInPage, never the router (see there why).
 */
export default function WeekPlanView() {
  const { t } = useTranslation();
  const { city } = useCity();
  const searchParams = useSearchParams();
  const sharedIds = useMemo(() => decodePlanParam(searchParams.get('plan')), [searchParams]);
  const idParam = searchParams.get('id');
  const today = useToday();
  const store = usePlans(city.id, today);

  const [draftId] = useState(() => newPlanId());
  // Once the URL names the draft it is an ordinary plan, and the bare URL
  // shows the list again. (State adjusted during render, not in an effect.)
  const [draftLanded, setDraftLanded] = useState(false);
  if (idParam === draftId && !draftLanded) setDraftLanded(true);
  const draft = useMemo(
    () => (today ? createPlan(draftId, mondayOf(today), today, 0) : null),
    [draftId, today]
  );

  // The plan just deleted, for "Cofnij".
  const [removed, setRemoved] = useState<SavedPlan | null>(null);

  const listPath = planPath(city.id);
  const actions: PlanActions | null = store && {
    create: (start) => {
      if (!today) return;
      const plan = createPlan(newPlanId(), start, today, Date.now());
      store.save(plan);
      trackEvent('week_plan_create');
      navigateInPage(planPath(city.id, plan.id));
    },
    rename: (plan, name) => {
      store.save({ ...plan, name });
      trackEvent('week_plan_rename');
    },
    remove: (plan, leaving) => {
      store.remove(plan.id);
      setRemoved(plan);
      trackEvent('week_plan_delete');
      if (leaving) navigateInPage(listPath, { replace: true });
    },
  };

  let view: React.ReactNode = null;
  if (sharedIds.length > 0) {
    view = <SharedPlan ids={sharedIds} store={store} />;
  } else if (today && store && actions && draft) {
    const current = isPlanId(idParam) ? store.plans.find((p) => p.id === idParam) : undefined;
    const draftSaved = store.plans.find((p) => p.id === draftId);
    // Every planner sits in this one slot under its plan's id, so the draft
    // keeps its state (shortlists, skips) when it is saved and gets its ?id=.
    if (current) {
      view = <Planner key={current.id} plan={current} saved today={today} store={store} actions={actions} />;
    } else if (idParam) {
      // Just deleted from its own planner: the list is on its way.
      view = removed?.id === idParam ? null : <PlanGone listPath={listPath} />;
    } else if (!draftLanded && (store.plans.length === 0 || draftSaved)) {
      view = (
        <Planner
          key={draftId}
          plan={draftSaved ?? draft}
          saved={draftSaved !== undefined}
          today={today}
          store={store}
          actions={actions}
        />
      );
    } else {
      view = (
        <PlansList
          plans={store.plans}
          today={today}
          onCreate={actions.create}
          onRename={actions.rename}
          onDelete={(plan) => actions.remove(plan, false)}
        />
      );
    }
  }

  return (
    <div className={styles.container}>
      {view}
      <Snackbar
        open={removed !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setRemoved(null);
        }}
        message={removed && today ? t.WEEK_PLAN_DELETED(planTitle(t, removed, today)) : ''}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              if (removed) store?.save(removed);
              setRemoved(null);
            }}
          >
            {t.WEEK_PLAN_UNDO}
          </Button>
        }
      />
    </div>
  );
}

interface PlanActions {
  create: (start: string) => void;
  rename: (plan: SavedPlan, name: string | null) => void;
  /** `leaving`: deleted from its own planner, which then gives way to the list. */
  remove: (plan: SavedPlan, leaving: boolean) => void;
}

function PlanGone({ listPath }: { listPath: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.notice} role="status">
      <p>{t.WEEK_PLAN_GONE}</p>
      <Button variant="contained" disableElevation href={withBasePath(listPath)} onClick={followInPage(listPath)}>
        {t.WEEK_PLANS_BACK}
      </Button>
    </div>
  );
}

type Messages = ReturnType<typeof useTranslation>['t'];

function dayLabel(t: Messages, date: string, locale: string): string {
  return `${t.WEEKDAY_LONG[weekdayOf(date)]}, ${formatDateShort(date, locale)}`;
}

function costLabel(t: Messages, cost: PlanCost): string {
  return planCostLabel(t, cost);
}

// Long enough to read "Wybrane!" on the card before the dialog closes.
const PICK_ANIMATION_MS = 450;
// How long a freshly placed tile keeps its entrance class.
const FRESH_MS = 1600;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Building a plan ──────────────────────────────────────────────────────────
//
// The page is the week itself: a board with a card per chosen day and a tile
// per slot. Choosing happens in a dialog opened from an empty tile, so the
// shortlist never sits in the board's flow — a first version laid the three
// cards of every day one under another and the days ran into each other.

interface PlannerProps {
  plan: SavedPlan;
  /** False for the draft a visitor with no plans starts on. */
  saved: boolean;
  today: string;
  store: PlansStore;
  actions: PlanActions;
}

function Planner({ plan, saved, today, store, actions }: PlannerProps) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { displayNameToSlug } = useCategories();
  const cityLocative = city.locativeForm[locale];

  const dates = useMemo(() => openDates(plan.start, today), [plan.start, today]);
  // What the plan held when it opened: a draft untouched since is not saved.
  const [initial] = useState(() => ({ ...plan }));
  const [state, setState] = useState<PlanState>(() => ({ ...emptyPlan(initial.settings), chosen: initial.chosen }));
  const [renaming, setRenaming] = useState(false);
  const [choosingWeek, setChoosingWeek] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  // Slots that just got an event: their tiles play the entrance animation,
  // one after another for "Zaskocz mnie" (the order is the stagger).
  const [fresh, setFresh] = useState<string[]>([]);
  const markFresh = useCallback((ids: string[]) => {
    setFresh(ids);
    window.setTimeout(() => setFresh([]), FRESH_MS + ids.length * 120);
  }, []);
  const withRoutine = wantsRoutine(state.settings.moods);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: eventsKeys.planCandidates(city.id, dates, withRoutine),
    queryFn: () => fetchPlanCandidates(city.id, dates, withRoutine),
    staleTime: 10 * 60_000,
    // Classes arrive only once "Aktywnie" is on; until that read lands the
    // previous candidates (a subset) keep the board and the dialog working.
    placeholderData: keepPreviousData,
  });
  const fetched = useMemo(() => new Map((data ?? []).map((c) => [c.event.id, c])), [data]);

  // Chosen events the week's read does not carry — a copied plan's gym class
  // while "Aktywnie" is off, a concert that has since sold out — are read by
  // id, so a decision is never dropped just because the draw would not offer it.
  const missingIds = useMemo(
    () =>
      data
        ? [...new Set(Object.values(state.chosen))]
            .filter((id) => !fetched.has(id))
            .sort((a, b) => a.localeCompare(b))
        : [],
    [data, fetched, state.chosen]
  );
  const pinned = useQuery({
    queryKey: eventsKeys.sharedPlan(city.id, missingIds),
    queryFn: () => fetchEventsByIds(city.id, missingIds),
    enabled: missingIds.length > 0,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
  const candidates = useMemo(() => {
    const merged = new Map(fetched);
    for (const event of pinned.data ?? []) if (!merged.has(event.id)) merged.set(event.id, pinnedCandidate(event));
    return merged;
  }, [fetched, pinned.data]);
  // Until the by-id read answers, an absent choice may just be unread.
  const pinnedSettled = missingIds.length === 0 || (pinned.isSuccess && !pinned.isPlaceholderData);

  const [copiedToast, setCopiedToast] = useState<CopiedFlag | null>(null);
  useEffect(() => {
    const flag = takeCopiedFlag();
    if (flag) setCopiedToast(flag);
  }, []);

  const dispatch = useCallback(
    (action: PlanAction) => setState((s) => planReducer(s, action, { candidates, rng: Math.random })),
    [candidates]
  );

  // New candidates (first load, classes switched on): draw the open slots
  // again around them. A stored choice whose event is gone drops out first.
  useEffect(() => {
    if (!data || !pinnedSettled) return;
    setState((s) => {
      const chosen = Object.fromEntries(Object.entries(s.chosen).filter(([, id]) => candidates.has(id)));
      return planReducer({ ...s, chosen }, { type: 'settings', settings: s.settings }, {
        candidates,
        rng: Math.random,
      });
    });
  }, [data, candidates, pinnedSettled]);

  // Every change is saved. A draft is saved on its first real change — a
  // choice, or other days or moods — and only then gets its address (?id=),
  // so a visitor who only looks around leaves no empty plan behind.
  useEffect(() => {
    const { settings, chosen } = state;
    if (saved) {
      // The stored plan, not `initial`: it may have been renamed since. Gone
      // (deleted here or in another tab) means it stays gone.
      const latest = store.plans.find((p) => p.id === initial.id);
      if (latest) store.save({ ...latest, settings, chosen });
      return;
    }
    if (Object.keys(chosen).length === 0 && sameSettings(settings, initial.settings)) return;
    store.save({ ...initial, settings, chosen, createdAt: Date.now() });
    navigateInPage(planPath(city.id, initial.id), { replace: true });
  }, [city.id, initial, saved, state, store]);

  const title = planTitle(t, plan, today);
  const range = planRange(plan.start, locale);
  // Past the week the events table holds densely, fewer events are known yet.
  const ahead = dates.some((date) => date > shiftDateString(today, 6));

  const slots = planSlots(state.settings);
  const chosen = chosenInOrder(state, candidates);
  const openSlots = slots.filter((s) => !state.chosen[s.id]).length;
  const pickingSlot = slots.find((s) => s.id === picking) ?? null;
  const hrefOf = (event: Event) => eventPath(city.id, event, displayNameToSlug);
  const ready = candidates.size > 0;

  return (
    <>
      <header className={styles.header}>
        {saved && (
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            className={styles.back}
            href={withBasePath(planPath(city.id))}
            onClick={followInPage(planPath(city.id))}
          >
            {t.WEEK_PLANS_BACK}
          </Button>
        )}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{saved ? title : t.WEEK_TITLE}</h1>
          {saved && (
            <PlanMenu
              title={title}
              onRename={() => setRenaming(true)}
              onDelete={() => actions.remove(plan, true)}
            />
          )}
        </div>
        <p className={styles.rangeLine}>
          {saved ? range : `${title} · ${range}`}
          {plan.origin === 'copy' && <span className={styles.badge}>{t.WEEK_PLAN_COPY_BADGE}</span>}
        </p>
        {!saved && <p className={styles.subtitle}>{t.WEEK_SUB(cityLocative)}</p>}
        {ahead && <p className={styles.hint}>{t.WEEK_PLAN_AHEAD_HINT}</p>}
        {!saved && (
          <Button
            size="small"
            startIcon={<DateRangeIcon />}
            className={styles.otherWeek}
            onClick={() => setChoosingWeek(true)}
          >
            {t.WEEK_PLANS_OTHER_WEEK}
          </Button>
        )}
      </header>

      <div className={styles.toolbar}>
        <Button
          variant="contained"
          size="large"
          disableElevation
          startIcon={<CasinoIcon />}
          disabled={!ready || openSlots === 0}
          onClick={() => {
            markFresh(slots.filter((s) => !state.chosen[s.id] && (state.proposals[s.id]?.length ?? 0) > 0).map((s) => s.id));
            dispatch({ type: 'autofill' });
          }}
        >
          {t.WEEK_SURPRISE}
        </Button>
        {/* Until candidates load, stored choices cannot be shown yet: do not call the plan "ready". */}
        <p className={styles.toolbarHint}>{!ready || openSlots > 0 ? t.WEEK_SURPRISE_HINT : t.WEEK_BOARD_FULL}</p>
      </div>

      <PlanFilters
        settings={state.settings}
        dates={dates}
        onChange={(settings) => dispatch({ type: 'settings', settings })}
      />

      {isError ? (
        <div className={styles.notice} role="alert">
          <p>{t.WEEK_ERROR}</p>
          <Button variant="outlined" onClick={() => refetch()}>
            {t.WEEK_RETRY}
          </Button>
        </div>
      ) : isLoading && !ready ? (
        <p className={styles.notice} role="status">
          {t.WEEK_LOADING}
        </p>
      ) : state.settings.days.length === 0 ? (
        <p className={styles.notice}>{t.WEEK_NO_DAYS}</p>
      ) : (
        <ol className={styles.board} aria-label={t.WEEK_TITLE}>
          {[...state.settings.days]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((day) => (
              <li key={day.date} className={styles.day}>
                <h2 className={styles.dayTitle}>
                  <span className={styles.dayName}>{t.WEEKDAY_LONG[weekdayOf(day.date)]}</span>
                  <span className={styles.dayDate}>{formatDateShort(day.date, locale)}</span>
                </h2>
                <ul className={styles.daySlots}>
                  {slots
                    .filter((slot) => slot.date === day.date)
                    .map((slot, index) => {
                      const event = state.chosen[slot.id] ? candidates.get(state.chosen[slot.id])?.event : undefined;
                      const freshAt = fresh.indexOf(slot.id);
                      return (
                        <li
                          key={slot.id}
                          className={`${styles.daySlot} ${event && freshAt >= 0 ? styles.daySlotFresh : ''}`}
                          style={freshAt >= 0 ? ({ '--stagger': freshAt } as React.CSSProperties) : undefined}
                        >
                          {event ? (
                            <PlanEventCard event={event} href={hrefOf(event)} variant="compact">
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => {
                                  dispatch({ type: 'unchoose', slotId: slot.id });
                                  setPicking(slot.id);
                                }}
                              >
                                {t.WEEK_CHANGE}
                              </Button>
                              <Button
                                size="small"
                                color="inherit"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => dispatch({ type: 'unchoose', slotId: slot.id })}
                              >
                                {t.WEEK_REMOVE_EVENT}
                              </Button>
                            </PlanEventCard>
                          ) : (
                            <div className={styles.emptySlot}>
                              <button
                                type="button"
                                className={styles.emptySlotButton}
                                disabled={!ready}
                                onClick={() => setPicking(slot.id)}
                              >
                                <AddIcon fontSize="small" />
                                <span>
                                  <span className={styles.emptySlotLabel}>{t.WEEK_PICK}</span>
                                  {slot.part !== 'any' && (
                                    <span className={styles.emptySlotPart}>{t.WEEK_PART[slot.part]}</span>
                                  )}
                                </span>
                              </button>
                              <IconButton
                                size="small"
                                aria-label={t.WEEK_REMOVE_SLOT(index + 1)}
                                onClick={() => dispatch({ type: 'removeSlot', slotId: slot.id })}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
                {day.parts.length < MAX_SLOTS_PER_DAY && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    className={styles.dayAdd}
                    onClick={() => dispatch({ type: 'addSlot', date: day.date })}
                  >
                    {t.WEEK_ADD_SLOT}
                  </Button>
                )}
                <DayCost events={chosen.filter((e) => e.date === day.date)} />
              </li>
            ))}
        </ol>
      )}

      <div className={styles.clearRow}>
        <Button
          size="small"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={() => {
            // A clean slate: default days, nothing chosen, nothing skipped.
            const settings = settingsForDays(defaultDaysOf(dates));
            setState(planReducer(emptyPlan(settings), { type: 'settings', settings }, { candidates, rng: Math.random }));
          }}
        >
          {t.WEEK_RESET}
        </Button>
      </div>

      <ChooserDialog
        slot={pickingSlot}
        state={state}
        candidates={candidates}
        hrefOf={hrefOf}
        dispatch={dispatch}
        onChosen={(id) => markFresh([id])}
        onClose={() => setPicking(null)}
      />

      <SummaryBar chosen={chosen} total={slots.length} />

      <Snackbar
        open={copiedToast !== null}
        autoHideDuration={5000}
        onClose={() => setCopiedToast(null)}
        message={copiedToast === 'again' ? t.WEEK_SHARED_ALREADY_COPIED : t.WEEK_SHARED_COPIED}
      />
      <PlanNameDialog
        open={renaming}
        name={plan.name ?? ''}
        fallback={planTitle(t, { ...plan, name: null }, today)}
        onSave={(name) => {
          actions.rename(plan, name);
          setRenaming(false);
        }}
        onClose={() => setRenaming(false)}
      />
      <NewPlanDialog
        open={choosingWeek}
        today={today}
        plans={store.plans}
        onChoose={(start) => {
          setChoosingWeek(false);
          actions.create(start);
        }}
        onClose={() => setChoosingWeek(false)}
      />
    </>
  );
}

// ── Filters: days and moods ──────────────────────────────────────────────────

interface PlanFiltersProps {
  settings: PlanSettings;
  dates: string[];
  onChange: (settings: PlanSettings) => void;
}

function PlanFilters({ settings, dates, onChange }: PlanFiltersProps) {
  const { t, locale } = useTranslation();
  const picked = new Set(settings.days.map((d) => d.date));

  const toggleDay = (date: string) => {
    const days = picked.has(date)
      ? settings.days.filter((d) => d.date !== date)
      : [...settings.days, { date, parts: ['any' as DayPart] }].sort((a, b) => a.date.localeCompare(b.date));
    onChange({ ...settings, days });
  };
  const toggleMood = (mood: Mood) =>
    onChange({
      ...settings,
      moods: settings.moods.includes(mood) ? settings.moods.filter((m) => m !== mood) : [...settings.moods, mood],
    });

  return (
    <section className={styles.filters} aria-label={t.WEEK_FILTERS}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.WEEK_DAYS_LABEL}</legend>
        <div className={styles.chips}>
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              className={`${styles.chip} ${styles.dayChip} ${picked.has(date) ? styles.chipOn : ''}`}
              aria-pressed={picked.has(date)}
              onClick={() => toggleDay(date)}
            >
              <span className={styles.chipDay}>{t.WEEKDAY_SHORT[weekdayOf(date)]}</span>
              <span className={styles.chipDate}>{formatDateShort(date, locale)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.WEEK_MOODS_LABEL}</legend>
        <div className={styles.moods}>
          {MOODS.map((mood) => (
            <MoodTile
              key={mood}
              mood={mood}
              icon={MOOD_ICONS[mood]}
              title={t.WEEK_MOOD[mood]}
              sub={t.WEEK_MOOD_SUB[mood]}
              on={settings.moods.includes(mood)}
              onClick={() => toggleMood(mood)}
            />
          ))}
          <MoodTile
            mood="free"
            icon={<SavingsIcon />}
            title={t.WEEK_FREE_ONLY}
            sub={t.WEEK_FREE_SUB}
            on={settings.freeOnly}
            onClick={() => onChange({ ...settings, freeOnly: !settings.freeOnly })}
          />
        </div>
        <p className={styles.hint}>{t.WEEK_MOODS_HINT}</p>
      </fieldset>
    </section>
  );
}

const MOOD_ICONS: Record<Mood, React.ReactNode> = {
  culture: <TheaterComedyIcon />,
  music: <MusicNoteIcon />,
  party: <CelebrationIcon />,
  active: <DirectionsRunIcon />,
  kids: <ChildCareIcon />,
  learn: <HandymanIcon />,
};

interface MoodTileProps {
  mood: Mood | 'free';
  icon: React.ReactNode;
  title: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}

/** A mood as a small coloured tile — the same visual language as the home tiles. */
function MoodTile({ mood, icon, title, sub, on, onClick }: MoodTileProps) {
  return (
    <button
      type="button"
      className={`${styles.mood} ${styles[`mood-${mood}`]} ${on ? styles.moodOn : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className={styles.moodIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.moodText}>
        <span className={styles.moodTitle}>{title}</span>
        <span className={styles.moodSub}>{sub}</span>
      </span>
      {on && <CheckIcon className={styles.moodCheck} fontSize="small" aria-hidden="true" />}
    </button>
  );
}

function DayCost({ events }: { events: Event[] }) {
  const { t } = useTranslation();
  if (events.length === 0) return null;
  return (
    <p className={styles.dayCost}>
      <span>{t.WEEK_COST_DAY}</span>
      <strong>{costLabel(t, planCost(events))}</strong>
    </p>
  );
}

// ── The chooser ──────────────────────────────────────────────────────────────

interface ChooserDialogProps {
  slot: PlanSlot | null;
  state: PlanState;
  candidates: ReadonlyMap<string, PlanCandidate>;
  hrefOf: (event: Event) => string;
  dispatch: (action: PlanAction) => void;
  onChosen: (slotId: string) => void;
  onClose: () => void;
}

/**
 * Three proposals for one slot. "Wybieram" marks the card, then puts the
 * event on the board and closes; "Pomiń" swaps that card only; the time of
 * day redraws the three.
 */
function ChooserDialog({ slot, state, candidates, hrefOf, dispatch, onChosen, onClose }: ChooserDialogProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const offered = slot ? (state.proposals[slot.id] ?? []) : [];
  const [picked, setPicked] = useState<string | null>(null);

  const pick = (slotId: string, eventId: string) => {
    if (picked) return;
    const finish = () => {
      dispatch({ type: 'choose', slotId, eventId });
      onChosen(slotId);
      setPicked(null);
      onClose();
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    setPicked(eventId);
    window.setTimeout(finish, PICK_ANIMATION_MS);
  };

  return (
    <Dialog
      open={slot !== null}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
      aria-labelledby="week-chooser-title"
    >
      {slot && (
        <>
          <DialogTitle id="week-chooser-title" className={styles.chooserTitle}>
            <span>{dayLabel(t, slot.date, locale)}</span>
            <IconButton aria-label={t.WEEK_CLOSE} onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <p className={styles.chooserSub}>{t.WEEK_PICK_SUB}</p>
            <div className={styles.chips} role="radiogroup" aria-label={t.WEEK_PART_TITLE}>
              {DAY_PARTS.map((part) => (
                <button
                  key={part}
                  type="button"
                  role="radio"
                  aria-checked={slot.part === part}
                  className={`${styles.chip} ${slot.part === part ? styles.chipOn : ''}`}
                  onClick={() => dispatch({ type: 'setPart', slotId: slot.id, part })}
                >
                  {t.WEEK_PART[part]}
                </button>
              ))}
            </div>
            {offered.length === 0 ? (
              <p className={styles.empty}>{t.WEEK_EMPTY_SLOT}</p>
            ) : (
              <div className={styles.cards}>
                {offered.map((id) => {
                  const candidate = candidates.get(id);
                  if (!candidate) return null;
                  return (
                    <PlanEventCard
                      key={id}
                      event={candidate.event}
                      href={hrefOf(candidate.event)}
                      picked={picked === id ? t.WEEK_PICKED : undefined}
                      dimmed={picked !== null && picked !== id}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        startIcon={<CheckIcon />}
                        onClick={() => pick(slot.id, id)}
                      >
                        {t.WEEK_CHOOSE}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<SkipNextIcon />}
                        disabled={picked !== null}
                        onClick={() => dispatch({ type: 'skip', slotId: slot.id, eventId: id })}
                      >
                        {t.WEEK_SKIP}
                      </Button>
                    </PlanEventCard>
                  );
                })}
              </div>
            )}
          </DialogContent>
          <DialogActions className={styles.chooserActions}>
            <Button startIcon={<CasinoIcon />} onClick={() => dispatch({ type: 'reroll', slotId: slot.id })}>
              {t.WEEK_REROLL_SLOT}
            </Button>
            <Button onClick={onClose}>{t.WEEK_CLOSE}</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

// ── Summary: calendar, share ─────────────────────────────────────────────────

interface SummaryBarProps {
  chosen: Event[];
  total: number;
}

function usePlanIcs(events: Event[]): string {
  const { t } = useTranslation();
  return useMemo(
    () =>
      events.length > 0
        ? icsDataUri(buildIcsCalendar(events.map((e) => toCalendarEvent(e, t.CALENDAR_END_GUESS))))
        : '',
    [events, t]
  );
}

function SummaryBar({ chosen, total }: SummaryBarProps) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const ics = usePlanIcs(chosen);

  return (
    <div className={styles.summary} role="region" aria-label={t.WEEK_SUMMARY_LABEL}>
      <div>
        <p className={styles.summaryText}>
          {chosen.length > 0 ? t.WEEK_SUMMARY(chosen.length, total) : t.WEEK_SUMMARY_EMPTY}
        </p>
        {chosen.length > 0 && (
          <p className={styles.summaryCost}>
            {t.WEEK_COST_WEEK}: <strong>{costLabel(t, planCost(chosen))}</strong>{' '}
            <span className={styles.summaryCostNote}>{t.WEEK_COST_PER_PERSON}</span>
          </p>
        )}
      </div>
      <div className={styles.summaryActions}>
        {ics ? (
          <Button
            variant="contained"
            disableElevation
            startIcon={<EventIcon />}
            href={ics}
            download={`${t.WEEK_CALENDAR_FILE}.ics`}
          >
            {t.WEEK_CALENDAR}
          </Button>
        ) : (
          <Button variant="contained" disableElevation startIcon={<EventIcon />} disabled>
            {t.WEEK_CALENDAR}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<ShareIcon />}
          disabled={chosen.length === 0}
          onClick={() => setSharing(true)}
        >
          {t.WEEK_SHARE}
        </Button>
      </div>
      <PlanShareDialog open={sharing} onClose={() => setSharing(false)} events={chosen} source="plan" />
    </div>
  );
}

// ── Someone else's plan ──────────────────────────────────────────────────────

function SharedPlan({ ids, store }: { ids: string[]; store: PlansStore | null }) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { displayNameToSlug } = useCategories();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: eventsKeys.sharedPlan(city.id, ids),
    queryFn: () => fetchEventsByIds(city.id, ids),
  });

  const today = toLocalDateString(new Date());
  const events = useMemo(() => sortPlanEvents((data ?? []).filter((e) => e.date >= today)), [data, today]);
  const missing = data ? ids.length - events.length : 0;
  const days = [...new Set(events.map((e) => e.date))];
  const ics = usePlanIcs(events);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The recipient's own copy: a new plan next to theirs (nothing of theirs
  // changes), opened in the planner, where everything can change. The same
  // link copied twice opens the first copy instead of making another.
  const copyToMine = () => {
    if (!store) return;
    const copy = planFromEvents(events, today);
    if (!copy) {
      setToast(t.WEEK_SHARED_NOTHING_TO_COPY);
      return;
    }
    const sourceKey = copySourceKey(ids);
    const existing = store.plans.find((p) => p.sourceKey === sourceKey);
    if (existing) {
      setCopiedFlag('again');
      trackEvent('shared_plan_copy_again');
      navigateInPage(planPath(city.id, existing.id), { replace: true });
      return;
    }
    const plan: SavedPlan = { id: newPlanId(), name: null, origin: 'copy', sourceKey, createdAt: Date.now(), ...copy };
    store.save(plan);
    setCopiedFlag('new');
    trackEvent('shared_plan_copy');
    navigateInPage(planPath(city.id, plan.id), { replace: true });
  };

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.WEEK_SHARED_TITLE}</h1>
      </header>
      {isError ? (
        <div className={styles.notice} role="alert">
          <p>{t.WEEK_ERROR}</p>
          <Button variant="outlined" onClick={() => refetch()}>
            {t.WEEK_RETRY}
          </Button>
        </div>
      ) : isLoading ? (
        <p className={styles.notice} role="status">
          {t.WEEK_LOADING}
        </p>
      ) : (
        <>
          {events.length === 0 ? (
            <p className={styles.notice}>{t.WEEK_SHARED_EMPTY}</p>
          ) : (
            <>
              {missing > 0 && <p className={styles.hint}>{t.WEEK_SHARED_MISSING(missing)}</p>}
              <ol className={styles.board}>
                {days.map((date) => (
                  <li key={date} className={styles.day}>
                    <h2 className={styles.dayTitle}>
                      <span className={styles.dayName}>{t.WEEKDAY_LONG[weekdayOf(date)]}</span>
                      <span className={styles.dayDate}>{formatDateShort(date, locale)}</span>
                    </h2>
                    <ul className={styles.daySlots}>
                      {events
                        .filter((e) => e.date === date)
                        .map((event) => (
                          <li key={event.id} className={styles.daySlot}>
                            <PlanEventCard
                              event={event}
                              href={eventPath(city.id, event, displayNameToSlug)}
                              variant="compact"
                            />
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className={styles.sharedCta}>
            {events.length > 0 && (
              <>
                <Button
                  variant="contained"
                  size="large"
                  disableElevation
                  startIcon={<ContentCopyIcon />}
                  onClick={copyToMine}
                >
                  {t.WEEK_SHARED_COPY}
                </Button>
                <p className={styles.sharedCtaHint}>{t.WEEK_SHARED_COPY_HINT}</p>
                <div className={styles.sharedCtaRow}>
                  <Button variant="outlined" startIcon={<EventIcon />} href={ics} download={`${t.WEEK_CALENDAR_FILE}.ics`}>
                    {t.WEEK_CALENDAR}
                  </Button>
                  <Button variant="outlined" startIcon={<ShareIcon />} onClick={() => setSharing(true)}>
                    {t.WEEK_SHARED_FORWARD}
                  </Button>
                </div>
              </>
            )}
            <Button
              variant={events.length > 0 ? 'text' : 'contained'}
              disableElevation
              startIcon={<CasinoIcon />}
              href={withBasePath(planPath(city.id))}
              onClick={followInPage(planPath(city.id))}
            >
              {t.WEEK_SHARED_CTA}
            </Button>
          </div>
          <PlanShareDialog open={sharing} onClose={() => setSharing(false)} events={events} source="shared_plan" />
        </>
      )}
      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </>
  );
}
