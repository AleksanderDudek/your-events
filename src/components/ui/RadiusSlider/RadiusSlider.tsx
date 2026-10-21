'use client';

import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { MAX_RADIUS_M, MIN_RADIUS_M, RADIUS_STEP_M } from '@/lib/geo';
import { formatDistance } from '@/lib/utils';

interface RadiusSliderProps {
  /** Metres. */
  value: number;
  /** Called when the thumb is released or a key is pressed — not on every pixel of a drag. */
  onChange: (radius: number) => void;
}

export default function RadiusSlider({ value, onChange }: Readonly<RadiusSliderProps>) {
  const { t, locale } = useTranslation();
  const labelId = useId();
  // The thumb follows a drag locally and the value is reported on release, so
  // a drag across the whole range is one URL change and one query, not ten.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;
  const format = (radius: number) => formatDistance(radius, locale);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography id={labelId} variant="body2" component="span" sx={{ fontWeight: 600 }}>
          {t.NEAR_RADIUS}
        </Typography>
        <Typography
          variant="body2"
          component="span"
          aria-hidden
          sx={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent-primary)' }}
        >
          {format(shown)}
        </Typography>
      </Box>
      <Slider
        value={shown}
        min={MIN_RADIUS_M}
        max={MAX_RADIUS_M}
        step={RADIUS_STEP_M}
        marks
        size="small"
        aria-labelledby={labelId}
        getAriaValueText={format}
        onChange={(_, next) => setDragValue(next as number)}
        onChangeCommitted={(_, next) => {
          setDragValue(null);
          onChange(next as number);
        }}
        // Inset so the thumb is not clipped at either end of a narrow panel.
        sx={{ mx: 1, width: 'calc(100% - 16px)' }}
      />
    </Box>
  );
}
