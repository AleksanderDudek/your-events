'use client';

// Leaflet touches `window` at import time, so this module is only ever loaded
// through the dynamic import in LocationPickerDialog (ssr: false).
import { useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/lib/geo';
import {
  AREA_PATH_OPTIONS,
  ORIGIN_ANCHOR,
  ORIGIN_SIZE,
  originMarkup,
} from '@/components/common/EventsMap/markerVisuals';
import 'leaflet/dist/leaflet.css';
import styles from './LocationPicker.module.scss';

export interface LocationPickerMapProps {
  /** Where the map opens. Read once, like every MapContainer prop. */
  initialCenter: LatLng;
  point: LatLng | null;
  radius: number;
  onPick: (point: LatLng) => void;
  /** Reports where the map is centred, for "drop it at the centre". */
  onCenterChange: (center: LatLng) => void;
}

function MapEvents({
  onPick,
  onCenterChange,
}: Pick<LocationPickerMapProps, 'onPick' | 'onCenterChange'>) {
  const map = useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({
  initialCenter,
  point,
  radius,
  onPick,
  onCenterChange,
}: Readonly<LocationPickerMapProps>) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: originMarkup(),
        className: styles.originIcon,
        iconSize: ORIGIN_SIZE,
        iconAnchor: ORIGIN_ANCHOR,
      }),
    []
  );

  return (
    <MapContainer center={[initialCenter.lat, initialCenter.lng]} zoom={14} className={styles.map}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onPick={onPick} onCenterChange={onCenterChange} />
      {point && (
        <>
          <Circle
            center={[point.lat, point.lng]}
            radius={radius}
            pathOptions={AREA_PATH_OPTIONS}
            interactive={false}
          />
          <Marker
            position={[point.lat, point.lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const next = (event.target as L.Marker).getLatLng();
                onPick({ lat: next.lat, lng: next.lng });
              },
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
