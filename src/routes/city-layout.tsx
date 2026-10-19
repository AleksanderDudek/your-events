import { Outlet } from 'react-router';
import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';
import { getCity, isCityId } from '@/config/cities';
import type { Route } from './+types/city-layout';

// Only live cities are prerendered, so a cold load of /unknown-city/… is
// already GitHub Pages' 404.html. This catches the client-side way there: a
// stale link or a hand-edited URL followed inside the app.
export default function CityLayout({ params }: Route.ComponentProps) {
  if (!isCityId(params.city) || !getCity(params.city).available) return <NotFoundRedirect />;
  return <Outlet />;
}
