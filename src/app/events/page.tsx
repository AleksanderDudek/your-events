import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsListView from '@/components/views/EventsListView/EventsListView';
import { S } from '@/lib/strings';
import EventsListLoading from './loading';

export const metadata: Metadata = {
  title: S.META_EVENTS_TITLE,
  description: S.META_DESCRIPTION,
};

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsListLoading />}>
      <EventsListView />
    </Suspense>
  );
}
