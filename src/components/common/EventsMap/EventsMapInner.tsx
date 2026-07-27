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
import {
  FALLBACK_COLOR,
  PIN_ANCHOR,
  PIN_POPUP_ANCHOR,
  PIN_SIZE,
  clusterMarkup,
  clusterRadiusForZoom,
  clusterSize,
  pinMarkup,
  uniformValue,
} from './markerVisuals';
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

// Category of the events under a marker, stashed on the Leaflet marker so a
// cluster can ask its children what they are without carrying Event objects.
interface CategorisedMarkerOptions extends L.MarkerOptions {
  categoryName?: string;
  categoryColor?: string;
}

function createPinIcon(category: string, color: string): L.DivIcon {
  // Inline SVG — avoids Leaflet's default icon URLs (which break in Next's
  // static export) and lets each pin carry its category's colour and glyph.
  return L.divIcon({
    html: pinMarkup(category, color),
    className: styles.pinIcon,
    iconSize: PIN_SIZE,
    iconAnchor: PIN_ANCHOR,
    popupAnchor: PIN_POPUP_ANCHOR,
  });
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const children = cluster.getAllChildMarkers();
  const options = children.map((m) => m.options as CategorisedMarkerOptions);
  const category = uniformValue(options.map((o) => o.categoryName ?? ''));
  // The colour is taken from the agreed category rather than checked on its
  // own: two categories can share a hue, and a bubble tinted like a category it
  // only half contains is worse than an honestly neutral one.
  const color = category ? options[0]?.categoryColor ?? null : null;
  const count = cluster.getChildCount();

  return L.divIcon({
    html: clusterMarkup(count, category || null, color),
    // `marker-cluster` is markercluster's own class, normally applied by the
    // default icon builder we are replacing. Keeping it means everything that
    // identifies a cluster by that class — the map e2e spec included — still
    // works; our module class layers the branded artwork on top.
    className: `marker-cluster ${styles.clusterIcon}`,
    iconSize: L.point(clusterSize(count), clusterSize(count)),
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
          // Radius tightens as you zoom, so each step buys real separation —
          // see clusterRadiusForZoom.
          maxClusterRadius: clusterRadiusForZoom,
          iconCreateFunction: createClusterIcon,
          // Events sharing a venue sit on identical coordinates, so no amount of
          // zoom pulls them apart. Clicking such a cluster fans them out instead
          // of zooming into a point that never resolves.
          spiderfyOnMaxZoom: true,
          spiderfyDistanceMultiplier: 1.6,
        });

    for (const ev of usable) {
      const marker = L.marker([ev.location.lat as number, ev.location.lng as number], {
        icon: createPinIcon(ev.categoryMain, colorFor(ev)),
        title: ev.name,
        categoryName: ev.categoryMain,
        categoryColor: colorFor(ev),
      } as CategorisedMarkerOptions);
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
