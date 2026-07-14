'use client';

import { CityProvider } from './CityProvider';
import { CityId } from './cities';

export default function CityRouteProvider({
  cityId,
  children,
}: {
  cityId: CityId;
  children: React.ReactNode;
}) {
  return <CityProvider initialCityId={cityId}>{children}</CityProvider>;
}
