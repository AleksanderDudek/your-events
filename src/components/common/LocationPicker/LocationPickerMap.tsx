'use client';

// Leaflet touches `window` at import time, so this module is only ever loaded
// through the dynamic import in LocationPickerDialog (ssr: false).
import { useMemo, useState } from 'react';
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
  /** Where the map opens when there is no point yet. Read once, like every MapContainer prop. */
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
  // wrap(): Leaflet reports a click on a repeated copy of the world with a
  // longitude past ±180, which the URL rightly rejects — the pick would
  // vanish without a word.
  const map = useMapEvents({
    click: (event) => onPick(toPoint(event.latlng)),
    moveend: () => onCenterChange(toPoint(map.getCenter())),
  });
  return null;
}

function toPoint(latlng: L.LatLng): LatLng {
  const { lat, lng } = latlng.wrap();
  return { lat, lng };
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
  // Opened on an existing point, the map frames its whole circle; otherwise it
  // shows the city centre at street level. Both are read only on mount.
  const [initialView] = useState(() =>
    point
      ? { bounds: L.latLng(point.lat, point.lng).toBounds(radius * 2) }
      : { center: L.latLng(initialCenter.lat, initialCenter.lng), zoom: 14 }
  );

  return (
    <MapContainer
      {...initialView}
      boundsOptions={{ padding: [16, 16] }}
      // A city-sized picker: zoomed out further than a region, the world starts
      // repeating and a point stops meaning anything for a 5 km radius.
      minZoom={10}
      className={styles.map}
    >
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
              dragend: (event) => onPick(toPoint((event.target as L.Marker).getLatLng())),
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
