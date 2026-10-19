import { data } from 'react-router';
import type { RelatedEventLink } from '@/components/common/RelatedEvents/RelatedEvents';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import { getCategories, getCityEvents } from '@/components/service/eventsApi';
import { getCity, isCityId } from '@/config/cities';
import { eventJsonLd } from '@/lib/eventJsonLd';
import { scriptSafeJson } from '@/lib/inlineScript';
import { pickRelatedEvents } from '@/lib/relatedEvents';
import { buildMeta } from '@/lib/seo';
import { buildCategorySlugMap, eventPath, shortId } from '@/lib/slug';
import type { Route } from './+types/event-detail';

// The short id is the last dash-separated part of the slug: {name}-{shortid}.
function idFromSlug(slug: string): string {
  return slug.slice(slug.lastIndexOf('-') + 1);
}

// Runs at build time only, once per prerendered event. An event added to
// Supabase since the last build has no page — GitHub Pages serves 404.html,
// whose router lands in the root ErrorBoundary and redirects to the city list.
export async function loader({ params }: Route.LoaderArgs) {
  const { city, event: eventSlug } = params;
  if (!isCityId(city) || !getCity(city).available) throw data(null, { status: 404 });

  const candidates = await getCityEvents(city);
  const id = idFromSlug(eventSlug);
  const event = candidates.find((e) => shortId(e.eventKey) === id);
  if (!event) throw data(null, { status: 404 });

  // Similar events, resolved here rather than in the browser: the city's events
  // are already loaded for this build (getCityEvents caches them), so this costs
  // no extra query and ships as plain HTML. Building the permalinks here also
  // matters — the category map they need does not exist on the client until
  // useCategories resolves.
  const slugMap = buildCategorySlugMap(await getCategories());
  const related: RelatedEventLink[] = pickRelatedEvents({ target: event, candidates, now: new Date() }).map(
    (e) => ({ event: e, href: eventPath(city, e, slugMap) })
  );

  return { event, related, cityName: getCity(city).displayName.pl };
}

// Client navigation, and a boot from 404.html, read the prerendered data file
// through this. Without a clientLoader, React Router never requests that file
// when the app starts at a path the build did not write — an event added since
// the last build — and fails with an internal error instead of the 404 the
// missing file means.
export const clientLoader = ({ serverLoader }: Route.ClientLoaderArgs) => serverLoader();

export const meta = ({ loaderData: page, params }: Route.MetaArgs) => {
  if (!page) return buildMeta({ title: 'Wydarzenie nie znalezione', robots: 'noindex' });
  const { event } = page;
  const description = event.description.slice(0, 160);
  return buildMeta({
    title: `${event.name} — ${event.date}`,
    description,
    canonicalPath: `/${params.city}/${params.category}/${params.event}`,
    ogType: 'article',
    image: event.imageUrl || undefined,
  });
};

export default function EventDetailPage({ loaderData }: Route.ComponentProps) {
  const { event, related, cityName } = loaderData;
  return (
    <>
      <script
        type="application/ld+json"
        // Event text is scraped from third-party sites: scriptSafeJson keeps a
        // name containing "</script>" from closing this block early.
        dangerouslySetInnerHTML={{ __html: scriptSafeJson(eventJsonLd(event, cityName)) }}
      />
      <EventDetailView event={event} related={related} />
    </>
  );
}
