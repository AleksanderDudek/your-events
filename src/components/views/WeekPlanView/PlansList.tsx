'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { fetchEventsByIds } from '@/components/service/eventsApi';
import { eventsKeys } from '@/components/service/queryKeys';
import { withBasePath } from '@/lib/constants';
import { navigateInPage } from '@/lib/inPageNavigation';
import { sortPlanEvents } from '@/lib/planShare';
import { formatDateShort } from '@/lib/utils';
import { weekdayOf } from '@/lib/weekPlan';
import { SavedPlan } from '@/lib/weekPlans';
import type { Event } from '@/types/event.types';
import NewPlanDialog from './NewPlanDialog';
import PlanMenu from './PlanMenu';
import PlanNameDialog from './PlanNameDialog';
import { planRange, planTitle } from './planLabels';
import styles from './WeekPlanView.module.scss';

/** Events named on a card; the rest are counted. */
const CARD_EVENTS = 3;
/** A ceiling on one by-id read for the cards (21 per plan at most). */
const MAX_SUMMARY_IDS = 150;

export function planPath(cityId: string, id?: string): string {
  return `/${cityId}/moj-tydzien/${id ? `?id=${id}` : ''}`;
}

/**
 * A link to one of my plans. A real anchor (a new tab works), but a plain click
 * goes through navigateInPage: a <Link> to the page already open does not
 * navigate in the static export.
 */
export function followInPage(path: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    navigateInPage(path);
  };
}

interface PlansListProps {
  plans: SavedPlan[];
  today: string;
  onCreate: (start: string) => void;
  onRename: (plan: SavedPlan, name: string | null) => void;
  onDelete: (plan: SavedPlan) => void;
}

/** "Twoje plany": a card per plan, and a new one for this week or the next three. */
export default function PlansList({ plans, today, onCreate, onRename, onDelete }: PlansListProps) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<SavedPlan | null>(null);

  // One read for every card's events.
  const ids = useMemo(
    () =>
      [...new Set(plans.flatMap((p) => Object.values(p.chosen)))]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, MAX_SUMMARY_IDS),
    [plans]
  );
  const { data } = useQuery({
    queryKey: eventsKeys.sharedPlan(city.id, ids),
    queryFn: () => fetchEventsByIds(city.id, ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
  });
  const events = useMemo(() => new Map((data ?? []).map((e) => [e.id, e])), [data]);

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.WEEK_PLANS_TITLE}</h1>
        <p className={styles.subtitle}>{t.WEEK_PLANS_SUB(city.locativeForm[locale])}</p>
      </header>

      <div className={styles.toolbar}>
        <Button
          variant="contained"
          size="large"
          disableElevation
          startIcon={<AddIcon />}
          onClick={() => setCreating(true)}
        >
          {t.WEEK_PLANS_NEW}
        </Button>
      </div>

      <ol className={styles.planList} aria-label={t.WEEK_PLANS_TITLE}>
        {plans.map((plan) => {
          const title = planTitle(t, plan, today);
          const chosen = Object.values(plan.chosen);
          const known = sortPlanEvents(chosen.flatMap((id) => events.get(id) ?? []));
          const path = planPath(city.id, plan.id);
          return (
            <li key={plan.id} className={styles.planCard}>
              <a
                className={styles.planCardLink}
                href={withBasePath(path)}
                onClick={followInPage(path)}
              >
                <span className={styles.planCardTitle}>{title}</span>
                <span className={styles.planCardRange}>
                  {planRange(plan.start, locale)}
                  {plan.origin === 'copy' && (
                    <span className={styles.badge}>{t.WEEK_PLAN_COPY_BADGE}</span>
                  )}
                </span>
                <span className={styles.planCardCount}>
                  {chosen.length > 0 ? t.WEEK_PLANS_EVENTS(chosen.length) : t.WEEK_PLANS_EMPTY_PLAN}
                </span>
                {known.length > 0 && (
                  <span className={styles.planCardEvents}>
                    {known.slice(0, CARD_EVENTS).map((event) => (
                      <span key={event.id} className={styles.planCardEvent}>
                        <span className={styles.planCardEventDay}>
                          {dayShort(t.WEEKDAY_SHORT, event, locale)}
                        </span>
                        {event.name}
                      </span>
                    ))}
                    {chosen.length > CARD_EVENTS && (
                      <span className={styles.planCardMore}>
                        {t.WEEK_PLANS_MORE(chosen.length - CARD_EVENTS)}
                      </span>
                    )}
                  </span>
                )}
              </a>
              <PlanMenu
                className={styles.planCardMenu}
                title={title}
                onRename={() => setRenaming(plan)}
                onDelete={() => onDelete(plan)}
              />
            </li>
          );
        })}
      </ol>

      <NewPlanDialog
        open={creating}
        today={today}
        plans={plans}
        onChoose={(start) => {
          setCreating(false);
          onCreate(start);
        }}
        onClose={() => setCreating(false)}
      />
      <PlanNameDialog
        open={renaming !== null}
        name={renaming?.name ?? ''}
        fallback={renaming ? planTitle(t, { ...renaming, name: null }, today) : ''}
        onSave={(name) => {
          if (renaming) onRename(renaming, name);
          setRenaming(null);
        }}
        onClose={() => setRenaming(null)}
      />
    </>
  );
}

/** "pt 27 lis". */
function dayShort(weekdays: readonly string[], event: Event, locale: string): string {
  return `${weekdays[weekdayOf(event.date)]} ${formatDateShort(event.date, locale)}`;
}
