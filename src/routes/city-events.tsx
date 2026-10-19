import EventsListView from '@/components/views/EventsListView/EventsListView';
import { useIsClient } from '@/components/service/useIsClient';
import { cityEventsSeo } from '@/lib/cityMeta';
import { buildMeta } from '@/lib/seo';
import type { Route } from './+types/city-events';

// No loader: the list reads Supabase in the browser, from the filters in the
// query string. That also means changing a filter never asks for a .data file.
export const meta = ({ params }: Route.MetaArgs) => {
  const { cityId, title, description } = cityEventsSeo(params.city);
  return buildMeta({ title, description, canonicalPath: `/${cityId}/wydarzenia` });
};

export default function CityEventsPage() {
  // Everything on this page follows the query string and data fetched in the
  // browser, and the build knows neither. Prerendered, it would ship
  // "Znaleziono 0 wydarzeń" and an empty state to every visitor and crawler,
  // then fail to hydrate on any filtered URL (?viewMode=row, ?categories=…).
  // So it renders on the client only — what the Next export did too, where
  // useSearchParams pushed this subtree out of the static HTML.
  return useIsClient() ? <EventsListView /> : null;
}
