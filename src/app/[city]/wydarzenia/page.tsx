import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsListView from '@/components/views/EventsListView/EventsListView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import { SITE_URL } from '@/config/site';

interface ListPageProps {
  params: Promise<Readonly<{ city: string }>>;
}

export async function generateMetadata({ params }: ListPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  return {
    title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative),
    alternates: { canonical: `${SITE_URL}/${cityId}/wydarzenia` },
  };
}

export default function CityEventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsListView />
    </Suspense>
  );
}
