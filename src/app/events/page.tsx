import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsListView from '@/components/views/EventsListView/EventsListView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import EventsListLoading from './loading';

// Server-side metadata is rendered at build time and can't react to the
// user's locale choice — default to Polish, matching DEFAULT_LOCALE.
export const metadata: Metadata = {
  title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE,
  description: messages[DEFAULT_LOCALE].META_DESCRIPTION,
};

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsListLoading />}>
      <EventsListView />
    </Suspense>
  );
}
