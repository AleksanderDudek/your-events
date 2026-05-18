'use client';

// All imports that touch `window` (Leaflet, its CSS) happen here. This module
// is only loaded via the dynamic import in EventsMap.tsx (ssr: false), never
// at SSR/build time.
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Event } from '@/types/event.types';
import { useCategories } from '@/components/service/useCategories';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import styles from './EventsMap.module.scss';

export interface EventsMapInnerProps {
  events: Event[];
  height?: number | string;
  center: { lat: number; lng: number };
  zoom?: number;
  // When true: fit map to all event pins after they load. When false: stay at
  // the provided center+zoom.
  fitToEvents?: boolean;
  // Skip clustering — for the detail page where there's exactly one pin.
  disableClustering?: boolean;
  // Disable user interaction — used for the homepage "preview" tile.
  interactive?: boolean;
  // Build the popup HTML for a marker. When omitted the popup is suppressed.
  renderPopup?: (event: Event) => string;
}

const FALLBACK_COLOR = '#ec4899';

function createPinIcon(color: string): L.DivIcon {
  // Inline SVG pin — avoids Leaflet's default icon URLs (which break in Next's
  // static export) and lets us tint each pin by category.
  const safeColor = color || FALLBACK_COLOR;
  return L.divIcon({
    html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M15 0C6.72 0 0 6.72 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.72 23.28 0 15 0z" fill="${safeColor}" stroke="white" stroke-width="2"/>
        <circle cx="15" cy="15" r="5.5" fill="white"/>
      </svg>`,
    className: styles.pinIcon,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });
}

interface MarkersLayerProps {
  events: Event[];
  colorFor: (event: Event) => string;
  disableClustering: boolean;
  renderPopup?: (event: Event) => string;
  fitToEvents: boolean;
}

function MarkersLayer({
  events,
  colorFor,
  disableClustering,
  renderPopup,
  fitToEvents,
}: MarkersLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Tear down whatever was there from the previous render before adding the
    // new layer — keeps the map clean when events/categories change.
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const usable = events.filter(
      (e) => e.location.lat !== null && e.location.lng !== null
    );
    if (usable.length === 0) return;

    const group: L.LayerGroup = disableClustering
      ? L.layerGroup()
      : // markerClusterGroup is added by side-effect import; the types live in
        // @types/leaflet.markercluster.
        L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
        });

    for (const ev of usable) {
      const marker = L.marker([ev.location.lat as number, ev.location.lng as number], {
        icon: createPinIcon(colorFor(ev)),
        title: ev.name,
      });
      if (renderPopup) {
        marker.bindPopup(renderPopup(ev), { maxWidth: 240, className: styles.popup });
      }
      group.addLayer(marker);
    }

    map.addLayer(group);
    layerRef.current = group;

    if (fitToEvents && usable.length > 0) {
      const bounds = L.latLngBounds(
        usable.map((e) => [e.location.lat as number, e.location.lng as number])
      );
      // padding keeps pins off the edges where popups would clip.
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, events, colorFor, disableClustering, renderPopup, fitToEvents]);

  return null;
}

export default function EventsMapInner({
  events,
  height = 360,
  center,
  zoom = 13,
  fitToEvents = false,
  disableClustering = false,
  interactive = true,
  renderPopup,
}: EventsMapInnerProps) {
  const { byDisplayName } = useCategories();

  const colorFor = useMemo(() => {
    return (event: Event) => {
      const cat = byDisplayName.get(event.categoryMain);
      return cat?.color || FALLBACK_COLOR;
    };
  }, [byDisplayName]);

  return (
    <div className={styles.mapWrap} style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        zoomControl={interactive}
        keyboard={interactive}
        attributionControl={true}
        className={styles.map}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkersLayer
          events={events}
          colorFor={colorFor}
          disableClustering={disableClustering}
          renderPopup={renderPopup}
          fitToEvents={fitToEvents}
        />
      </MapContainer>
    </div>
  );
}
