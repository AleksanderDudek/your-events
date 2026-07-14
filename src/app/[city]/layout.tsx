import { notFound } from 'next/navigation';
import { AVAILABLE_CITIES, isCityId, getCity } from '@/config/cities';
import CityRouteProvider from '@/config/CityRouteProvider';

export const dynamicParams = false;

export function generateStaticParams() {
  return AVAILABLE_CITIES.map((c) => ({ city: c.id }));
}

interface CityLayoutProps {
  children: React.ReactNode;
  params: Promise<Readonly<{ city: string }>>;
}

export default async function CityLayout({ children, params }: CityLayoutProps) {
  const { city } = await params;
  if (!isCityId(city) || !getCity(city).available) notFound();
  return <CityRouteProvider cityId={city}>{children}</CityRouteProvider>;
}
