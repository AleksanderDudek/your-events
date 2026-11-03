'use client';

import { useEffect, useState } from 'react';
import { PROMO_MEDIA, type ShareFormat } from '@/lib/share';
import { canShareFiles, mayShareFiles, prefersReducedData } from './webShare';

// Gets the promo file for one format ready to hand to navigator.share.
//
// The file is fetched when the dialog opens, not when "Udostępnij" is tapped:
// Safari only opens the share sheet while the tap's user activation is fresh,
// and a 4–6 MB download in between would use it up. So the tap has the File in
// hand and calls share() at once.
//
// Order of preference — the owner's "if something is wrong use fallback image":
//   1. the video, if it downloads and the browser says it can share it;
//   2. the still image, if the video stalls, fails, is refused by canShare,
//      or the visitor has Data Saver on (then without the "failed" notice);
//   3. nothing — the caption is shared as text.
// Browsers that cannot share files at all (most desktops) skip all of this:
// they never download the video and get the copy/download/link tools instead.

export type PromoMediaState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number | null }
  | {
      status: 'ready';
      kind: 'video' | 'image';
      file: File;
      objectUrl: string;
      /** True when the video was wanted but could not be used. */
      fellBack: boolean;
    }
  | { status: 'unavailable' };

// A download that delivers no bytes for this long is given up on. A stall,
// not a total: a slow but steady connection still gets the video.
export const STALL_TIMEOUT_MS = 10_000;

// Settled results, per format, for the life of the page: reopening the dialog
// or flipping between formats does not download anything twice.
const settled = new Map<ShareFormat, PromoMediaState>();

async function fetchFile(
  url: string,
  name: string,
  type: string,
  signal: AbortSignal,
  onProgress: (percent: number | null) => void,
  onBytes: () => void
): Promise<File> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total) {
    onProgress(null);
    return new File([await response.blob()], name, { type });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes();
    onProgress(Math.min(99, Math.round((received / total) * 100)));
  }
  return new File(chunks as BlobPart[], name, { type });
}

function ready(kind: 'video' | 'image', file: File, fellBack: boolean): PromoMediaState {
  return { status: 'ready', kind, file, objectUrl: URL.createObjectURL(file), fellBack };
}

export function usePromoMedia(format: ShareFormat, enabled: boolean): PromoMediaState {
  // Tagged with its format, so a switch never shows the other format's file
  // for the render before the effect catches up.
  const [tagged, setTagged] = useState<{ format: ShareFormat; value: PromoMediaState }>({
    format,
    value: { status: 'idle' },
  });

  useEffect(() => {
    if (!enabled) return;
    const setState = (value: PromoMediaState) => setTagged({ format, value });
    const known = settled.get(format);
    if (known) {
      setState(known);
      return;
    }
    if (!mayShareFiles()) {
      setState({ status: 'unavailable' });
      return;
    }

    const media = PROMO_MEDIA[format];
    const controller = new AbortController();
    let stall: ReturnType<typeof setTimeout> | undefined;
    const armStall = () => {
      clearTimeout(stall);
      stall = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
    };
    let cancelled = false;

    const run = async (): Promise<PromoMediaState> => {
      const saveData = prefersReducedData();
      if (!saveData) {
        setState({ status: 'loading', progress: 0 });
        armStall();
        try {
          const video = await fetchFile(
            media.video,
            media.videoName,
            'video/mp4',
            controller.signal,
            (progress) => !cancelled && setState({ status: 'loading', progress }),
            armStall
          );
          if (canShareFiles([video])) return ready('video', video, false);
        } catch {
          // Stalled, offline, 404 — fall back to the image below.
        } finally {
          clearTimeout(stall);
        }
      }
      if (cancelled) return { status: 'idle' };
      try {
        const image = await fetchFile(media.image, media.imageName, 'image/jpeg', new AbortController().signal, () => {}, () => {});
        if (canShareFiles([image])) return ready('image', image, !saveData);
      } catch {
        // Nothing to attach — text only.
      }
      return { status: 'unavailable' };
    };

    void run().then((result) => {
      if (cancelled) return;
      settled.set(format, result);
      setState(result);
    });

    return () => {
      // Closing the dialog or switching format mid-download: drop it, and let
      // the next open start fresh rather than caching a half-finished result.
      cancelled = true;
      clearTimeout(stall);
      controller.abort();
    };
  }, [format, enabled]);

  if (!enabled || tagged.format !== format) return { status: 'idle' };
  return tagged.value;
}

// Test seam.
export function resetPromoMediaForTests(): void {
  settled.clear();
}
