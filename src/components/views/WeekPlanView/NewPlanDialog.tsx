'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslation } from '@/i18n';
import { mondayOf, SavedPlan, weekOptions } from '@/lib/weekPlans';
import { planRange, weekName } from './planLabels';
import styles from './WeekPlanView.module.scss';

interface NewPlanDialogProps {
  open: boolean;
  today: string;
  /** The plans there are, to say which weeks already have one. */
  plans: readonly SavedPlan[];
  onChoose: (start: string) => void;
  onClose: () => void;
}

/** "Nowy plan": this week or one of the next three. */
export default function NewPlanDialog({
  open,
  today,
  plans,
  onChoose,
  onClose,
}: NewPlanDialogProps) {
  const { t, locale } = useTranslation();
  const taken = new Set(plans.map((p) => mondayOf(p.start)));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="new-plan-title">
      <DialogTitle id="new-plan-title">{t.WEEK_PLANS_NEW_TITLE}</DialogTitle>
      <DialogContent>
        <ul className={styles.weekOptions}>
          {weekOptions(today).map((option) => (
            <li key={option.start}>
              <button
                type="button"
                className={styles.weekOption}
                onClick={() => onChoose(option.start)}
              >
                <span className={styles.weekOptionName}>{weekName(t, option.start, today)}</span>
                <span className={styles.weekOptionRange}>{planRange(option.start, locale)}</span>
                {taken.has(option.start) && (
                  <span className={styles.weekOptionTaken}>{t.WEEK_PLANS_WEEK_TAKEN}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.WEEK_PLAN_CANCEL}</Button>
      </DialogActions>
    </Dialog>
  );
}
