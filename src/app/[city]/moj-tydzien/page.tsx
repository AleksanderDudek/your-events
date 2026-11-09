import { Suspense } from 'react';
import type { Metadata } from 'next';
import WeekPlanView from '@/components/views/WeekPlanView/WeekPlanView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import { DEFAULT_OG_IMAGES, SITE_URL } from '@/config/site';

interface WeekPlanPageProps {
  params: Promise<Readonly<{ city: string }>>;
}

export async function generateMetadata({ params }: WeekPlanPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  const m = messages[DEFAULT_LOCALE];
  return {
    title: m.WEEK_META_TITLE(locative),
    description: m.WEEK_META_DESCRIPTION(locative),
    alternates: { canonical: `${SITE_URL}/${cityId}/moj-tydzien` },
    openGraph: {
      title: m.WEEK_META_TITLE(locative),
      description: m.WEEK_META_DESCRIPTION(locative),
      type: 'website',
      images: DEFAULT_OG_IMAGES,
    },
  };
}

export default function WeekPlanPage() {
  // useSearchParams (the ?plan= share link) needs a Suspense boundary in a
  // static export.
  return (
    <Suspense fallback={null}>
      <WeekPlanView />
    </Suspense>
  );
}
