'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Snackbar from '@mui/material/Snackbar';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckIcon from '@mui/icons-material/Check';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';
import ShareIcon from '@mui/icons-material/Share';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
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
  planDates,
  planReducer,
  PlanSettings,
  planSlots,
  PlanState,
  StoredPlan,
  wantsRoutine,
  weekdayOf,
} from '@/lib/weekPlan';
import PlanEventCard from './PlanEventCard';
import styles from './WeekPlanView.module.scss';

export const WEEK_PLAN_STORAGE_PREFIX = 'go-to-city.week-plan.';
export const WEEK_PLAN_PATH = 'moj-tydzien';

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

// ── Building a plan ──────────────────────────────────────────────────────────

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
  const withRoutine = wantsRoutine(state.settings.moods);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: eventsKeys.planCandidates(city.id, dates, withRoutine),
    queryFn: () => fetchPlanCandidates(city.id, dates, withRoutine),
    staleTime: 10 * 60_000,
    // Gym classes arrive only once "Aktywnie" is on; until that read lands the
    // previous candidates (a subset) keep the cards on screen.
    placeholderData: keepPreviousData,
  });
  const candidates = useMemo(() => new Map((data ?? []).map((c) => [c.event.id, c])), [data]);

  const dispatch = useCallback(
    (action: PlanAction) => setState((s) => planReducer(s, action, { candidates, rng: Math.random })),
    [candidates]
  );

  // New candidates (first load, routine switched on): draw the open slots
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
  const hrefOf = (id: string) => {
    const event = candidates.get(id)?.event;
    return event ? eventPath(city.id, event, displayNameToSlug) : '#';
  };

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.WEEK_TITLE}</h1>
        <p className={styles.subtitle}>{t.WEEK_SUB(cityLocative)}</p>
      </header>

      <SettingsPanel
        settings={state.settings}
        dates={dates}
        onChange={(settings) => dispatch({ type: 'settings', settings })}
        onReroll={() => dispatch({ type: 'reroll' })}
        onReset={() => {
          // A clean slate: default days, nothing chosen, nothing skipped.
          const settings = defaultSettings(today);
          setState(planReducer(emptyPlan(settings), { type: 'settings', settings }, { candidates, rng: Math.random }));
        }}
      />

      {isError ? (
        <div className={styles.notice} role="alert">
          <p>{t.WEEK_ERROR}</p>
          <Button variant="outlined" onClick={() => refetch()}>
            {t.WEEK_RETRY}
          </Button>
        </div>
      ) : isLoading && candidates.size === 0 ? (
        <p className={styles.notice} role="status">
          {t.WEEK_LOADING}
        </p>
      ) : slots.length === 0 ? (
        <p className={styles.notice}>{t.WEEK_NO_DAYS}</p>
      ) : (
        <ol className={styles.slots}>
          {slots.map((slot) => {
            const decided = state.chosen[slot.id];
            const offered = state.proposals[slot.id] ?? [];
            const dayLabel = `${t.WEEKDAY_LONG[weekdayOf(slot.date)]}, ${formatDateShort(slot.date, locale)}`;
            return (
              <li key={slot.id} className={styles.slot}>
                <div className={styles.slotHeader}>
                  <h2 className={styles.slotTitle}>
                    {dayLabel}
                    {slot.part !== 'any' && <span className={styles.slotPart}> · {t.WEEK_PART[slot.part]}</span>}
                  </h2>
                  {!decided && offered.length > 0 && (
                    <Button
                      size="small"
                      startIcon={<CasinoIcon />}
                      onClick={() => dispatch({ type: 'reroll', slotId: slot.id })}
                    >
                      {t.WEEK_REROLL_SLOT}
                    </Button>
                  )}
                </div>
                {decided && candidates.get(decided) ? (
                  <div className={styles.cards}>
                    <PlanEventCard event={candidates.get(decided)!.event} href={hrefOf(decided)} chosen>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => dispatch({ type: 'unchoose', slotId: slot.id })}
                      >
                        {t.WEEK_CHANGE}
                      </Button>
                    </PlanEventCard>
                  </div>
                ) : offered.length === 0 ? (
                  <p className={styles.empty}>{t.WEEK_EMPTY_SLOT}</p>
                ) : (
                  <div className={styles.cards}>
                    {offered.map((id) => {
                      const candidate = candidates.get(id);
                      if (!candidate) return null;
                      return (
                        <PlanEventCard key={id} event={candidate.event} href={hrefOf(id)}>
                          <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            startIcon={<CheckIcon />}
                            onClick={() => dispatch({ type: 'choose', slotId: slot.id, eventId: id })}
                          >
                            {t.WEEK_CHOOSE}
                          </Button>
                          <Button
                            size="small"
                            startIcon={<SkipNextIcon />}
                            onClick={() => dispatch({ type: 'skip', slotId: slot.id, eventId: id })}
                          >
                            {t.WEEK_SKIP}
                          </Button>
                        </PlanEventCard>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <SummaryBar chosen={chosen} total={slots.length} />
    </>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  settings: PlanSettings;
  dates: string[];
  onChange: (settings: PlanSettings) => void;
  onReroll: () => void;
  onReset: () => void;
}

function SettingsPanel({ settings, dates, onChange, onReroll, onReset }: SettingsPanelProps) {
  const { t, locale } = useTranslation();
  const picked = new Map(settings.days.map((d) => [d.date, d]));
  const slotCount = settings.days.reduce((sum, d) => sum + d.parts.length, 0);

  const toggleDay = (date: string) => {
    const days = picked.has(date)
      ? settings.days.filter((d) => d.date !== date)
      : [...settings.days, { date, parts: ['any' as DayPart] }].sort((a, b) => a.date.localeCompare(b.date));
    onChange({ ...settings, days });
  };
  const setParts = (date: string, parts: DayPart[]) =>
    onChange({ ...settings, days: settings.days.map((d) => (d.date === date ? { ...d, parts } : d)) });
  const toggleMood = (mood: Mood) =>
    onChange({
      ...settings,
      moods: settings.moods.includes(mood) ? settings.moods.filter((m) => m !== mood) : [...settings.moods, mood],
    });

  return (
    <section className={styles.settings} aria-label={t.WEEK_SETTINGS}>
      <div className={styles.settingsBar}>
        <Button variant="contained" disableElevation startIcon={<CasinoIcon />} onClick={onReroll}>
          {t.WEEK_REROLL_ALL}
        </Button>
        <Button startIcon={<RestartAltIcon />} onClick={onReset}>
          {t.WEEK_RESET}
        </Button>
      </div>
      <Accordion disableGutters className={styles.accordion}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <span className={styles.accordionTitle}>{t.WEEK_SETTINGS}</span>
          <span className={styles.accordionMeta}>{t.WEEK_SETTINGS_SUMMARY(settings.days.length, slotCount)}</span>
        </AccordionSummary>
        <AccordionDetails>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.WEEK_DAYS_LABEL}</legend>
            <div className={styles.chips}>
              {dates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={`${styles.chip} ${picked.has(date) ? styles.chipOn : ''}`}
                  aria-pressed={picked.has(date)}
                  onClick={() => toggleDay(date)}
                >
                  <span className={styles.chipDay}>{t.WEEKDAY_SHORT[weekdayOf(date)]}</span>
                  <span className={styles.chipDate}>{formatDateShort(date, locale)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {settings.days.length > 0 && (
            <div className={styles.dayRows}>
              {settings.days.map((day) => (
                <div key={day.date} className={styles.dayRow}>
                  <span className={styles.dayRowLabel}>
                    {t.WEEKDAY_SHORT[weekdayOf(day.date)]} {formatDateShort(day.date, locale)}
                  </span>
                  <div className={styles.dayRowParts}>
                    {day.parts.map((part, i) => (
                      <span key={i} className={styles.partPicker}>
                        <select
                          className={styles.select}
                          aria-label={t.WEEK_PART_LABEL(i + 1)}
                          value={part}
                          onChange={(e) =>
                            setParts(
                              day.date,
                              day.parts.map((p, j) => (j === i ? (e.target.value as DayPart) : p))
                            )
                          }
                        >
                          {DAY_PARTS.map((p) => (
                            <option key={p} value={p}>
                              {t.WEEK_PART[p]}
                            </option>
                          ))}
                        </select>
                        {day.parts.length > 1 && (
                          <IconButton
                            size="small"
                            aria-label={t.WEEK_REMOVE_SLOT(i + 1)}
                            onClick={() => setParts(day.date, day.parts.filter((_, j) => j !== i))}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )}
                      </span>
                    ))}
                    {day.parts.length < MAX_SLOTS_PER_DAY && (
                      <Button size="small" startIcon={<AddIcon />} onClick={() => setParts(day.date, [...day.parts, 'any'])}>
                        {t.WEEK_ADD_SLOT}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.WEEK_MOODS_LABEL}</legend>
            <div className={styles.chips}>
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  className={`${styles.chip} ${settings.moods.includes(mood) ? styles.chipOn : ''}`}
                  aria-pressed={settings.moods.includes(mood)}
                  onClick={() => toggleMood(mood)}
                >
                  {t.WEEK_MOOD[mood]}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.chip} ${settings.freeOnly ? styles.chipOn : ''}`}
                aria-pressed={settings.freeOnly}
                onClick={() => onChange({ ...settings, freeOnly: !settings.freeOnly })}
              >
                {t.WEEK_FREE_ONLY}
              </button>
            </div>
            <p className={styles.hint}>{t.WEEK_MOODS_HINT}</p>
          </fieldset>
        </AccordionDetails>
      </Accordion>
    </section>
  );
}

// ── Summary: calendar, share ─────────────────────────────────────────────────

interface SummaryBarProps {
  chosen: PlanCandidate['event'][];
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
    <div className={styles.summary} role="region" aria-label={t.WEEK_SUMMARY(chosen.length, total)}>
      <p className={styles.summaryText}>
        {chosen.length > 0 ? t.WEEK_SUMMARY(chosen.length, total) : t.WEEK_SUMMARY_EMPTY}
      </p>
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
  const events = (data ?? []).filter((e) => e.date >= today).sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)
  );
  const missing = data ? ids.length - events.length : 0;

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
              <ol className={styles.slots}>
                {events.map((event) => (
                  <li key={event.id} className={styles.slot}>
                    <h2 className={styles.slotTitle}>
                      {t.WEEKDAY_LONG[weekdayOf(event.date)]}, {formatDateShort(event.date, locale)}
                    </h2>
                    <div className={styles.cards}>
                      <PlanEventCard event={event} href={eventPath(city.id, event, displayNameToSlug)} />
                    </div>
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
