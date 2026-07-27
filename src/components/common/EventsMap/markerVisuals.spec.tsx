import { describe, it, expect } from 'vitest';
import {
  FALLBACK_COLOR,
  MIXED_COLOR,
  clusterMarkup,
  clusterRadiusForZoom,
  clusterSize,
  glyphMarkup,
  pinMarkup,
  uniformValue,
} from './markerVisuals';

describe('glyphMarkup', () => {
  it('renders the category glyph as plain SVG markup', () => {
    const markup = glyphMarkup('Muzyka');
    expect(markup).toContain('<path');
    expect(markup).not.toContain('undefined');
  });

  it('falls back to the Inne glyph for a category with no artwork', () => {
    expect(glyphMarkup('Nie ma takiej kategorii')).toBe(glyphMarkup('Inne'));
  });

  it('resolves Polish display names through the same slug rule as the UI', () => {
    // The pin has to land on the glyph the chips and tiles already use, and
    // those key off slugify(display_name) — diacritics included.
    expect(glyphMarkup('Wellness i Duchowość')).not.toBe(glyphMarkup('Inne'));
  });
});

describe('pinMarkup', () => {
  it('paints the pin in the category colour and embeds its glyph', () => {
    const markup = pinMarkup('Taniec', '#ee4f86');
    expect(markup).toContain('fill="#ee4f86"');
    expect(markup).toContain(glyphMarkup('Taniec'));
  });

  it('falls back to the brand colour when the category has none', () => {
    expect(pinMarkup('Taniec', '')).toContain(`fill="${FALLBACK_COLOR}"`);
  });

  it('neutralises a colour that would break out of the attribute', () => {
    // Colours come from a database column, and this markup is handed to Leaflet
    // as raw HTML — a quote in that value would otherwise close the attribute.
    const markup = pinMarkup('Taniec', '"><script>alert(1)</script>');
    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&#34;');
  });
});

describe('uniformValue', () => {
  it('returns the shared value when every entry agrees', () => {
    expect(uniformValue(['Taniec', 'Taniec'])).toBe('Taniec');
  });

  it('returns null for a mixed set — a cluster must not claim one category', () => {
    expect(uniformValue(['Taniec', 'Muzyka'])).toBeNull();
  });

  it('returns null for an empty set', () => {
    expect(uniformValue([])).toBeNull();
  });
});

describe('clusterRadiusForZoom', () => {
  it('shrinks as the map zooms in', () => {
    const radii = [10, 12, 14, 15, 16].map(clusterRadiusForZoom);
    const sorted = [...radii].sort((a, b) => b - a);
    expect(radii).toEqual(sorted);
    expect(new Set(radii).size).toBe(radii.length);
  });

  it('stays well under markercluster\'s 80px default at every zoom', () => {
    // The default is what made the map a field of bubbles until you zoomed hard.
    for (let zoom = 0; zoom <= 19; zoom += 1) {
      expect(clusterRadiusForZoom(zoom)).toBeLessThanOrEqual(60);
      expect(clusterRadiusForZoom(zoom)).toBeGreaterThan(0);
    }
  });
});

describe('clusterSize', () => {
  it('grows with the count so density reads without a legend', () => {
    expect(clusterSize(2)).toBeLessThan(clusterSize(20));
    expect(clusterSize(20)).toBeLessThan(clusterSize(200));
  });
});

describe('clusterMarkup', () => {
  it('shows the glyph and colour when every event under it shares a category', () => {
    const markup = clusterMarkup(7, 'Muzyka', '#7c5ce0');
    expect(markup).toContain('--cluster-color:#7c5ce0');
    expect(markup).toContain('<span>7</span>');
    expect(markup).toContain('<svg');
  });

  it('keeps a mixed cluster out of the category palette', () => {
    // A neutral bubble is honest about holding several categories; a category
    // colour there would claim something the pins underneath do not support.
    const mixed = clusterMarkup(4, null, null);
    expect(mixed).toContain(`--cluster-color:${MIXED_COLOR}`);
    expect(MIXED_COLOR).not.toBe(FALLBACK_COLOR);
  });

  it('shows the count alone for a mixed cluster', () => {
    const markup = clusterMarkup(7, null, null);
    expect(markup).toContain(`--cluster-color:${MIXED_COLOR}`);
    expect(markup).toContain('<span>7</span>');
    expect(markup).not.toContain('<svg');
  });

  it('sizes the bubble from the count', () => {
    expect(clusterMarkup(200, null, null)).toContain(`--cluster-size:${clusterSize(200)}px`);
  });
});
