'use client';

import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { useTranslation } from '@/i18n';
import RadiusSlider from '@/components/ui/RadiusSlider/RadiusSlider';
import type { LatLng } from '@/lib/geo';
import styles from './LocationPicker.module.scss';

// Leaflet cannot load during the static export's prerender.
const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

interface LocationPickerDialogProps {
  /** Where the map opens when there is no point yet: the city centre. */
  fallbackCenter: LatLng;
  initialPoint: LatLng | null;
  initialRadius: number;
  onCancel: () => void;
  onConfirm: (point: LatLng, radius: number) => void;
}

/**
 * Drop a pin instead of typing an address. Mounted only while open, so each
 * opening starts from the filter's current point rather than from wherever a
 * cancelled attempt left the pin.
 */
export default function LocationPickerDialog({
  fallbackCenter,
  initialPoint,
  initialRadius,
  onCancel,
  onConfirm,
}: Readonly<LocationPickerDialogProps>) {
  const { t } = useTranslation();
  const titleId = useId();
  const muiTheme = useTheme();
  // A map wants every pixel a phone has.
  const fullScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [point, setPoint] = useState<LatLng | null>(initialPoint);
  const [radius, setRadius] = useState(initialRadius);
  const [center, setCenter] = useState<LatLng>(initialPoint ?? fallbackCenter);

  return (
    <Dialog
      open
      onClose={onCancel}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId} sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {t.NEAR_PICKER_TITLE}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          {t.NEAR_PICKER_HINT}
        </Typography>
        <div className={styles.mapSlot}>
          <LocationPickerMap
            initialCenter={initialPoint ?? fallbackCenter}
            point={point}
            radius={radius}
            onPick={setPoint}
            onCenterChange={setCenter}
          />
        </div>
        {/* A keyboard cannot click a map, but it can pan one (arrow keys); this
            drops the pin wherever the panning stopped. */}
        <Button
          size="small"
          startIcon={<CenterFocusStrongIcon />}
          onClick={() => setPoint(center)}
          sx={{ mb: 2 }}
        >
          {t.NEAR_PICKER_USE_CENTER}
        </Button>
        <RadiusSlider value={radius} onChange={setRadius} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{t.NEAR_PICKER_CANCEL}</Button>
        <Button
          variant="contained"
          disabled={!point}
          onClick={() => {
            if (point) onConfirm(point, radius);
          }}
        >
          {t.NEAR_PICKER_CONFIRM}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
