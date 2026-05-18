import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsListView from '@/components/views/EventsListView/EventsListView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity } from '@/config/cities';
import EventsListLoading from './loading';

// Server-side metadata is rendered at build time and can't react to the
// user's locale or city choice — default to Polish + the default city.
const cityLocative = getCity(DEFAULT_CITY_ID).locativeForm[DEFAULT_LOCALE];
export const metadata: Metadata = {
  title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(cityLocative),
  description: messages[DEFAULT_LOCALE].META_DESCRIPTION(cityLocative),
};

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsListLoading />}>
      <EventsListView />
    </Suspense>
  );
}
