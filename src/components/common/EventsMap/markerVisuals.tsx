// Marker artwork for the events map, kept free of Leaflet so it can be unit
// tested. EventsMapInner wraps the markup these produce in L.divIcon.
//
// The glyphs come from ui/CategoryIcon's path table — the same geometry the
// chips, tiles and category hubs draw — so a pin reads as the same category the
// rest of the UI shows. Leaflet wants an HTML string rather than React, hence
// the static render; keeping one path table beats hand-copying 13 glyphs into a
// second format that would drift the first time one is redrawn.
import { renderToStaticMarkup } from 'react-dom/server';
import { CATEGORY_ICON_PATHS } from '@/components/ui/CategoryIcon/paths';
import { slugify } from '@/lib/utils';

// Pin colour when a category carries none of its own.
export const FALLBACK_COLOR = '#ec4899';

// Cluster colour when the events underneath disagree on category. Deliberately
// outside the category palette: the first pink used here sat a few degrees from
// Taniec's, so a mixed bubble read as a category it only partly contained.
export const MIXED_COLOR = '#5f5968';

const PIN_WIDTH = 34;
const PIN_HEIGHT = 44;
// Glyphs are authored on a 24×24 grid; 0.75 renders them at 18px inside the
// pin head, and the stroke is divided back out so scaling does not thin it.
const GLYPH_SCALE = 0.75;
const GLYPH_STROKE = 1.8;

function escapeAttribute(value: string): string {
  return value.replace(/[<>"'&]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Inner SVG markup of a category's glyph, or the "Inne" glyph when unknown. */
export function glyphMarkup(category: string): string {
  const slug = slugify(category || 'inne');
  const glyph = CATEGORY_ICON_PATHS[slug] ?? CATEGORY_ICON_PATHS.inne;
  return renderToStaticMarkup(<>{glyph}</>);
}

/**
 * A teardrop pin in the category's colour with that category's glyph punched
 * into the head. Previously every pin was an identical white dot, so the map
 * could say "something is here" but not what — the whole point of this artwork
 * is answering that without a click.
 */
export function pinMarkup(category: string, color: string): string {
  const fill = escapeAttribute(color || FALLBACK_COLOR);
  return [
    `<svg width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 ${PIN_WIDTH} ${PIN_HEIGHT}"`,
    ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    `<path d="M17 0C7.6 0 0 7.6 0 17c0 11.9 17 27 17 27s17-15.1 17-27C34 7.6 26.4 0 17 0z"`,
    ` fill="${fill}" stroke="#ffffff" stroke-width="2"/>`,
    `<g transform="translate(8 8) scale(${GLYPH_SCALE})" fill="none" stroke="#ffffff"`,
    ` stroke-width="${GLYPH_STROKE / GLYPH_SCALE}" stroke-linecap="round" stroke-linejoin="round">`,
    glyphMarkup(category),
    '</g></svg>',
  ].join('');
}

export const PIN_SIZE: [number, number] = [PIN_WIDTH, PIN_HEIGHT];
export const PIN_ANCHOR: [number, number] = [PIN_WIDTH / 2, PIN_HEIGHT];
export const PIN_POPUP_ANCHOR: [number, number] = [0, -PIN_HEIGHT + 4];

/**
 * The colour a cluster should take: the one its children agree on, or null when
 * they do not. A mixed cluster deliberately gets no category colour — claiming
 * one would be a lie about what is underneath it.
 */
export function uniformValue(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

/** Bubble diameter in px. Bigger clusters read as bigger without a legend. */
export function clusterSize(count: number): number {
  if (count < 10) return 38;
  if (count < 50) return 46;
  return 56;
}

/**
 * How close two markers must be (in px) before they merge, per zoom level.
 *
 * markercluster defaults to a flat 80px; this map ran 50. Either way the map
 * stays a field of identical bubbles until you zoom hard, because the radius
 * does not care that zooming in has already pulled the pins apart on screen.
 * Shrinking it as zoom grows means each zoom step actually buys separation:
 * by street level only genuinely co-located events stay merged, and those
 * spiderfy on click.
 */
export function clusterRadiusForZoom(zoom: number): number {
  if (zoom >= 16) return 12;
  if (zoom >= 15) return 20;
  if (zoom >= 14) return 30;
  if (zoom >= 12) return 45;
  return 60;
}

/**
 * A cluster bubble: the count, plus the category glyph when every event under
 * it shares a category. Mixed clusters fall back to the brand colour and show
 * the count alone.
 */
export function clusterMarkup(count: number, category: string | null, color: string | null): string {
  const size = clusterSize(count);
  const fill = escapeAttribute(color || MIXED_COLOR);
  const glyph = category
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ffffff"
         stroke-width="${GLYPH_STROKE}" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">${glyphMarkup(category)}</svg>`
    : '';
  return [
    `<div style="--cluster-size:${size}px;--cluster-color:${fill}">`,
    glyph,
    `<span>${count}</span>`,
    '</div>',
  ].join('');
}
