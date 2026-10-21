'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useGeolocation, type GeolocationErrorKind } from '@/components/service/useGeolocation';
import LocationPickerDialog from '@/components/common/LocationPicker/LocationPickerDialog';
import RadiusSlider from '@/components/ui/RadiusSlider/RadiusSlider';
import { CITY_AREA_RADIUS_M, DEFAULT_RADIUS_M, distanceMeters, type LatLng } from '@/lib/geo';
import type { NearFilter } from '@/types/filter.types';
import AddressSearch from './AddressSearch';
import { nearPlaceName } from './nearPlaceName';
import styles from './NearbyFilter.module.scss';

interface NearbyFilterProps {
  value: NearFilter | null;
  onChange: (next: NearFilter | null) => void;
}

/**
 * The "near a point" section of the filter panel: the point, three ways to set
 * it — the device's location, an address, a pin on a map — and the radius.
 */
export default function NearbyFilter({ value, onChange }: Readonly<NearbyFilterProps>) {
  const { t } = useTranslation();
  const { city } = useCity();
  const { locate, isLocating, error } = useGeolocation();
  // A radius chosen before there is a point waits here for one.
  const [pendingRadius, setPendingRadius] = useState(DEFAULT_RADIUS_M);
  const [pickerOpen, setPickerOpen] = useState(false);
  const radius = value?.radius ?? pendingRadius;

  const errorMessages: Record<GeolocationErrorKind, string> = {
    denied: t.NEAR_ERROR_DENIED,
    unavailable: t.NEAR_ERROR_UNAVAILABLE,
    timeout: t.NEAR_ERROR_TIMEOUT,
    unsupported: t.NEAR_ERROR_UNSUPPORTED,
  };

  const choosePoint = (point: LatLng, label: string | null, nextRadius = radius) =>
    onChange({ lat: point.lat, lng: point.lng, radius: nextRadius, label });

  // Never `disabled`, even while locating: disabling the button that has focus
  // drops focus on <body>, and the drawer's focus trap then throws it to the
  // top of the panel. A press while waiting simply asks again (useGeolocation
  // keeps only the newest answer).
  const handleMyLocation = async () => {
    const fix = await locate();
    if (fix) choosePoint(fix, null);
  };

  const handleRadius = (next: number) => {
    setPendingRadius(next);
    if (value) onChange({ ...value, radius: next });
  };

  const farFromCity =
    value !== null && distanceMeters(value, city.coordinates) > CITY_AREA_RADIUS_M;

  return (
    <Box className={styles.root}>
      {value && (
        <Box className={styles.current}>
          <PlaceIcon sx={{ fontSize: 18, color: 'var(--color-accent-primary)', flexShrink: 0 }} />
          <Typography variant="body2" className={styles.currentName} sx={{ fontWeight: 600 }}>
            {nearPlaceName(value, t)}
          </Typography>
          <IconButton size="small" aria-label={t.NEAR_REMOVE} onClick={() => onChange(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {farFromCity && (
        <Alert severity="info" sx={{ py: 0, fontSize: '0.75rem' }}>
          {t.NEAR_FAR_FROM_CITY}
        </Alert>
      )}

      <Button
        variant="outlined"
        size="small"
        fullWidth
        onClick={handleMyLocation}
        aria-busy={isLocating}
        startIcon={isLocating ? <CircularProgress size={14} /> : <MyLocationIcon />}
      >
        {isLocating ? t.NEAR_LOCATING : t.NEAR_USE_MY_LOCATION}
      </Button>
      {error && (
        <Typography role="alert" variant="caption" color="error" className={styles.error}>
          {errorMessages[error]}
        </Typography>
      )}

      <AddressSearch onSelect={(suggestion) => choosePoint(suggestion, suggestion.label)} />

      <Button
        size="small"
        startIcon={<MapOutlinedIcon />}
        onClick={() => setPickerOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.NEAR_PICK_ON_MAP}
      </Button>

      <RadiusSlider value={radius} onChange={handleRadius} />

      {pickerOpen && (
        <LocationPickerDialog
          fallbackCenter={city.coordinates}
          initialPoint={value}
          initialRadius={radius}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(point, pickedRadius) => {
            setPickerOpen(false);
            setPendingRadius(pickedRadius);
            choosePoint(point, null, pickedRadius);
          }}
        />
      )}
    </Box>
  );
}
