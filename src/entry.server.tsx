import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext } from 'react-router';
import { createEmotionCache } from '@/lib/emotionCache';

// With `ssr: false` this never runs on a server: it is how the build renders
// each prerendered path (and the SPA fallback) to an HTML file.

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const cache = createEmotionCache();
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);

  const stream = await renderToReadableStream(
    <CacheProvider value={cache}>
      <ServerRouter context={routerContext} url={request.url} />
    </CacheProvider>,
    {
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError(error: unknown) {
        responseStatusCode = 500;
        console.error(error);
      },
    }
  );
  // A file on disk, not a streamed response: wait for every Suspense boundary.
  await stream.allReady;
  const html = await new Response(stream).text();

  // MUI's styles are Emotion's, and Emotion only knows them once the tree has
  // rendered. Extract the rules this page used and put them in <head>, so the
  // prerendered page is styled before any JavaScript runs.
  const chunks = extractCriticalToChunks(html);
  // The rules go into a <style> verbatim, and the browser ends that element at
  // the first `</style` it sees — even inside a CSS value. `\3c ` is the CSS
  // escape for `<`: same meaning, but it can no longer close the element.
  chunks.styles = chunks.styles.map((style) => ({
    ...style,
    css: style.css.replace(/<(?=\/?style\b)/gi, '\\3c '),
  }));
  const styles = constructStyleTagsFromChunks(chunks);
  // A function, so `$&` and friends in the stylesheet are not read as patterns.
  const document = styles ? html.replace('</head>', () => `${styles}</head>`) : html;

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(document, { headers: responseHeaders, status: responseStatusCode });
}
