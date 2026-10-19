import HomeView from '@/components/views/HomeView/HomeView';
import { cityEventsSeo } from '@/lib/cityMeta';
import { buildMeta } from '@/lib/seo';
import type { Route } from './+types/city';

export const meta = ({ params }: Route.MetaArgs) => {
  const { cityId, title, description } = cityEventsSeo(params.city);
  return buildMeta({ title, description, canonicalPath: `/${cityId}` });
};

export default function CityLandingPage() {
  return <HomeView />;
}
