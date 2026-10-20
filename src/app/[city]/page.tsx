import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomeView from '@/components/views/HomeView/HomeView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import { SITE_URL } from '@/config/site';

interface CityPageProps {
  params: Promise<Readonly<{ city: string }>>;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  return {
    title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative),
    description: messages[DEFAULT_LOCALE].META_DESCRIPTION(locative),
    alternates: { canonical: `${SITE_URL}/${cityId}` },
    openGraph: {
      title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative),
      description: messages[DEFAULT_LOCALE].META_DESCRIPTION(locative),
      type: 'website',
    },
  };
}

export default function CityLandingPage() {
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}
