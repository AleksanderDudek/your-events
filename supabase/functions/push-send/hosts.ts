// Defence in depth: the SQL layer already allowlists hosts, but this is the
// last check before a request leaves for an address a visitor chose.
export function isPushServiceUrl(endpoint: string): boolean {
  // Same rule as push_subscribe: these never appear in a genuine endpoint.
  if (/[\\@\s]/.test(endpoint)) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  const host = url.hostname;
  return (
    host === 'fcm.googleapis.com' ||
    host === 'web.push.apple.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host.endsWith('.notify.windows.com')
  );
}
