'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
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
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CelebrationIcon from '@mui/icons-material/Celebration';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import HandymanIcon from '@mui/icons-material/Handyman';
import SavingsIcon from '@mui/icons-material/Savings';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useCategories } from '@/components/service/useCategories';
import { fetchEventsByIds, fetchPlanCandidates } from '@/components/service/eventsApi';
import { eventsKeys } from '@/components/service/queryKeys';
import { copyText, hasNativeShare, nativeShare } from '@/components/service/webShare';
import { toLocalDateString } from '@/lib/dateWindows';
import { formatDateShort } from '@/lib/utils';
import { eventPath } from '@/lib/slug';
import { toCalendarEvent } from '@/lib/calendar/calendarEvent';
import { buildIcsCalendar, icsDataUri } from '@/lib/calendar/ics';
import {
  chosenInOrder,
  DAY_PARTS,
  DayPart,
  decodePlanParam,
  defaultSettings,
  emptyPlan,
  encodePlanParam,
  MAX_SLOTS_PER_DAY,
  Mood,
  MOODS,
  parseStoredPlan,
  PlanAction,
  PlanCandidate,
  PlanCost,
  planCost,
  planDates,
  planReducer,
  PlanSettings,
  PlanSlot,
  planSlots,
  PlanState,
  StoredPlan,
  wantsRoutine,
  weekdayOf,
} from '@/lib/weekPlan';
import { Event } from '@/types/event.types';
import PlanEventCard from './PlanEventCard';
import styles from './WeekPlanView.module.scss';

export const WEEK_PLAN_STORAGE_PREFIX = 'go-to-city.week-plan.';

function readStored(cityId: string, today: string): StoredPlan | null {
  try {
    return parseStoredPlan(window.localStorage.getItem(WEEK_PLAN_STORAGE_PREFIX + cityId), today);
  } catch {
    // Private mode / sandboxed iframe: a fresh plan every visit.
    return null;
  }
}

function writeStored(cityId: string, state: PlanState): void {
  try {
    const stored: StoredPlan = { settings: state.settings, chosen: state.chosen };
    window.localStorage.setItem(WEEK_PLAN_STORAGE_PREFIX + cityId, JSON.stringify(stored));
  } catch {
    // Storage full or blocked — the plan still works, it just will not survive a reload.
  }
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
 * "Twój tydzień". A `?plan=` link opens someone else's plan read-only;
 * without one the visitor builds their own.
 *
 * Everything here starts after mount: the page is a static export, and both
 * "today" and the stored plan only exist in the visitor's browser.
 */
export default function WeekPlanView() {
  const searchParams = useSearchParams();
  const sharedIds = useMemo(() => decodePlanParam(searchParams.get('plan')), [searchParams]);
  const today = useToday();

  return (
    <div className={styles.container}>
      {sharedIds.length > 0 ? <SharedPlan ids={sharedIds} /> : today && <Planner today={today} />}
    </div>
  );
}

type Messages = ReturnType<typeof useTranslation>['t'];

function dayLabel(t: Messages, date: string, locale: string): string {
  return `${t.WEEKDAY_LONG[weekdayOf(date)]}, ${formatDateShort(date, locale)}`;
}

/** "ok. 125 zł + 1 bez ceny", "za darmo", "cena w opisie". */
function costLabel(t: Messages, cost: PlanCost): string {
  if (cost.paid === 0) return cost.unknown > 0 ? t.WEEK_COST_UNKNOWN : t.WEEK_COST_FREE;
  const amount = t.WEEK_COST_AMOUNT(Math.round(cost.total));
  return cost.unknown > 0 ? `${amount} ${t.WEEK_COST_PLUS_UNKNOWN(cost.unknown)}` : amount;
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

function Planner({ today }: { today: string }) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { displayNameToSlug } = useCategories();
  const cityLocative = city.locativeForm[locale];

  const dates = useMemo(() => planDates(today), [today]);
  const stored = useMemo(() => readStored(city.id, today), [city.id, today]);
  const [state, setState] = useState<PlanState>(() =>
    stored ? { ...emptyPlan(stored.settings), chosen: stored.chosen } : emptyPlan(defaultSettings(today))
  );
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
  const candidates = useMemo(() => new Map((data ?? []).map((c) => [c.event.id, c])), [data]);

  const dispatch = useCallback(
    (action: PlanAction) => setState((s) => planReducer(s, action, { candidates, rng: Math.random })),
    [candidates]
  );

  // New candidates (first load, classes switched on): draw the open slots
  // again around them. A stored choice whose event is gone drops out first.
  useEffect(() => {
    if (!data) return;
    setState((s) => {
      const chosen = Object.fromEntries(Object.entries(s.chosen).filter(([, id]) => candidates.has(id)));
      return planReducer({ ...s, chosen }, { type: 'settings', settings: s.settings }, {
        candidates,
        rng: Math.random,
      });
    });
  }, [data, candidates]);

  useEffect(() => writeStored(city.id, state), [city.id, state]);

  const slots = planSlots(state.settings);
  const chosen = chosenInOrder(state, candidates);
  const openSlots = slots.filter((s) => !state.chosen[s.id]).length;
  const pickingSlot = slots.find((s) => s.id === picking) ?? null;
  const hrefOf = (event: Event) => eventPath(city.id, event, displayNameToSlug);
  const ready = candidates.size > 0;

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.WEEK_TITLE}</h1>
        <p className={styles.subtitle}>{t.WEEK_SUB(cityLocative)}</p>
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
            const settings = defaultSettings(today);
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

function SummaryBar({ chosen, total }: SummaryBarProps) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const ics = useMemo(
    () => (chosen.length > 0 ? icsDataUri(buildIcsCalendar(chosen.map((e) => toCalendarEvent(e, t.CALENDAR_END_GUESS)))) : ''),
    [chosen, t]
  );

  const share = async () => {
    // Origin + this page's own path, so a base path (the dev deployment) is kept.
    const url = `${window.location.origin}${pathname}?plan=${encodePlanParam(chosen.map((e) => e.id))}`;
    const text = t.WEEK_SHARE_TEXT(city.locativeForm[locale]);
    if (hasNativeShare()) {
      const outcome = await nativeShare({ title: t.WEEK_TITLE, text, url });
      if (outcome === 'shared' || outcome === 'cancelled') return;
    }
    if (await copyText(url)) setCopied(true);
  };

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
        <Button variant="outlined" startIcon={<ShareIcon />} disabled={chosen.length === 0} onClick={share}>
          {t.WEEK_SHARE}
        </Button>
      </div>
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
        message={t.WEEK_LINK_COPIED}
      />
    </div>
  );
}

// ── Someone else's plan ──────────────────────────────────────────────────────

function SharedPlan({ ids }: { ids: string[] }) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { displayNameToSlug } = useCategories();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: eventsKeys.sharedPlan(city.id, ids),
    queryFn: () => fetchEventsByIds(city.id, ids),
  });

  const today = toLocalDateString(new Date());
  const events = (data ?? [])
    .filter((e) => e.date >= today)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const missing = data ? ids.length - events.length : 0;
  const days = [...new Set(events.map((e) => e.date))];

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
            <Button
              variant="contained"
              disableElevation
              startIcon={<CasinoIcon />}
              onClick={() => router.replace(pathname as Route)}
            >
              {t.WEEK_SHARED_CTA}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
