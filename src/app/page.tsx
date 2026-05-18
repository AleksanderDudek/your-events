import { Suspense } from 'react';
import HomeView from '@/components/views/HomeView/HomeView';

export default function HomePage() {
  // HomeView reads search params (for the map preview's useEvents query), so
  // Next.js requires a Suspense boundary around it during prerender.
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}
