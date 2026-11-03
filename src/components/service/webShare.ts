// Thin, testable wrappers over the browser's share and clipboard APIs. Every
// function degrades instead of throwing: sharing is a convenience, and a
// browser without it should get the copy/download/link fallbacks, not an error.

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export function hasNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

// Whether this browser could share files at all. Used before downloading the
// video, so a desktop that cannot attach files never pulls 4–6 MB for nothing.
export function mayShareFiles(): boolean {
  return hasNativeShare() && typeof navigator.canShare === 'function';
}

export function canShareFiles(files: File[]): boolean {
  if (!mayShareFiles()) return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export async function nativeShare(data: ShareData): Promise<ShareOutcome> {
  if (!hasNativeShare()) return 'unsupported';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    // AbortError: the visitor closed the sheet. Not a failure worth a toast.
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

// The async Clipboard API needs a secure context and, in some browsers, focus;
// the textarea + execCommand path covers the rest (older iOS, http previews).
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// Data Saver / "Lite mode". Chromium-only; elsewhere this reads false.
export function prefersReducedData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}
