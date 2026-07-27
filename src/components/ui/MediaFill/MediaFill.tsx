'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './MediaFill.module.scss';

interface MediaFillProps {
  src: string;
  // Empty string marks the image decorative — the caller's aria-label already
  // names the event in both places this is used.
  alt: string;
  sizes: string;
  onError?: () => void;
  priority?: boolean;
}

// How much of an image we are willing to crop in order to fill the slot edge to
// edge. Measured against the real catalogue: at 0.25 the 800×500 generated
// covers (1.60 in a 16/9 slot) lose 10% off their sides — gradient margin, well
// clear of the text drawn into them — while portrait flyers (0.67, which would
// lose 62%) and square art (1.0, 44%) keep every pixel.
const MAX_CROP = 0.25;

type Fit = 'contain' | 'cover';

/**
 * `cover` when filling the slot costs at most MAX_CROP of the image, otherwise
 * `contain`. Exported so the thresholds can be pinned without a browser — jsdom
 * lays nothing out, so the component itself cannot reach this decision there.
 */
export function pickFit(imageRatio: number, slotRatio: number): Fit {
  if (!(imageRatio > 0) || !(slotRatio > 0)) return 'contain';
  const crop = 1 - Math.min(imageRatio, slotRatio) / Math.max(imageRatio, slotRatio);
  return crop <= MAX_CROP ? 'cover' : 'contain';
}

/**
 * Shows an image inside a slot whose aspect ratio it does not share.
 *
 * Event art is third-party and its ratio runs from 0.67 (portrait flyer) to
 * 2.70 (banner); the majority are 1.60 generated covers with the event name
 * drawn into them. One `object-fit` cannot serve that spread: `cover` throws
 * away whatever does not fit, and `contain` leaves most of the slot empty for
 * anything tall.
 *
 * So the fit is chosen per image, once its intrinsic size is known:
 *
 *   - close to the slot's ratio (crop ≤ MAX_CROP) → `cover`. It fills the slot
 *     edge to edge and the sliver lost is margin, not content.
 *   - far from it → `contain` over a blurred, scaled copy of itself. Nothing is
 *     cropped, and the empty space carries the image's own colours instead of
 *     reading as a dead bar.
 *
 * `contain` is the SSR default because it is the safe one: it can only ever
 * under-fill, never hide part of a poster. Both layers share a URL, so the
 * browser fetches and decodes the image once.
 */
export default function MediaFill({ src, alt, sizes, onError, priority }: MediaFillProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Keyed by src so a new source falls back to `contain` during render rather
  // than through an effect — the next image's ratio is unknown until it loads,
  // and `contain` is the fit that cannot hide part of it.
  const [decided, setDecided] = useState<{ src: string; fit: Fit }>({ src, fit: 'contain' });
  const fit: Fit = decided.src === src ? decided.fit : 'contain';

  const decideFit = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const { width, height } = img.getBoundingClientRect();
    if (!width || !height) return;

    // Keyed by the src PROP, not img.src — next/image resolves the latter to an
    // absolute, base-path-prefixed URL, which would never match and would pin
    // every image to `contain`.
    setDecided({ src, fit: pickFit(img.naturalWidth / img.naturalHeight, width / height) });
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // ResizeObserver fires once on observe(), which doubles as the check for an
    // image the browser already had cached — there, onLoad may never fire.
    // decideFit bails out while naturalWidth is still 0, so a not-yet-decoded
    // image simply waits for onLoad.
    //
    // It also keeps the decision honest on the detail hero, whose slot ratio
    // moves with the viewport because its aspect-ratio is clamped by max-height.
    const observer = new ResizeObserver(decideFit);
    observer.observe(img);
    return () => observer.disconnect();
  }, [decideFit]);

  return (
    <>
      {fit === 'contain' && (
        <Image
          src={src}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          className={styles.backdrop}
          // No onError here: the foreground carries the same src and reports the
          // failure once. `unoptimized` because next.config uses output:'export'.
          unoptimized
          priority={priority}
        />
      )}
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={fit === 'cover' ? styles.foregroundCover : styles.foreground}
        onLoad={decideFit}
        onError={onError}
        unoptimized
        priority={priority}
      />
    </>
  );
}
