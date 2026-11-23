'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useTranslation } from '@/i18n';
import { cleanPlanName, MAX_PLAN_NAME } from '@/lib/weekPlans';

interface PlanNameDialogProps {
  open: boolean;
  /** The name it has now; empty for a plan named after its week. */
  name: string;
  /** What an empty field falls back to, shown as the placeholder. */
  fallback: string;
  onSave: (name: string | null) => void;
  onClose: () => void;
}

/** "Zmień nazwę". An empty name gives the plan its week's name back. */
export default function PlanNameDialog({
  open,
  name,
  fallback,
  onSave,
  onClose,
}: PlanNameDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="plan-name-title">
      {/* Keyed by open: each opening starts from the plan's current name. */}
      {open && (
        <NameForm key={name} name={name} fallback={fallback} onSave={onSave} onClose={onClose} />
      )}
    </Dialog>
  );
}

function NameForm({ name, fallback, onSave, onClose }: Omit<PlanNameDialogProps, 'open'>) {
  const { t } = useTranslation();
  const [value, setValue] = useState(name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(cleanPlanName(value));
      }}
    >
      <DialogTitle id="plan-name-title">{t.WEEK_PLAN_RENAME}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t.WEEK_PLAN_RENAME_LABEL}
          placeholder={fallback}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          helperText={t.WEEK_PLAN_RENAME_HINT}
          slotProps={{ htmlInput: { maxLength: MAX_PLAN_NAME } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.WEEK_PLAN_CANCEL}</Button>
        <Button type="submit" variant="contained" disableElevation>
          {t.WEEK_PLAN_SAVE}
        </Button>
      </DialogActions>
    </form>
  );
}
