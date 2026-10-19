import { type RouteConfig, index, route } from '@react-router/dev/routes';

// The page tree, one module per page. Each one is thin — its meta, and for the
// two data-driven pages a build-time loader — over a view in src/components.
//
// Static segments rank ahead of `:city`, so no city id can shadow
// /moje-filtry, /prywatnosc or /rozwijaj-z-nami; likewise `wydarzenia` ahead of
// `:category`.
export default [
  index('routes/home.tsx'),
  route('moje-filtry', 'routes/my-filters.tsx'),
  route('prywatnosc', 'routes/privacy.tsx'),
  route('rozwijaj-z-nami', 'routes/grow-with-us.tsx'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route(':city', 'routes/city-layout.tsx', [
    index('routes/city.tsx'),
    route('wydarzenia', 'routes/city-events.tsx'),
    route(':category', 'routes/category-hub.tsx'),
    route(':category/:event', 'routes/event-detail.tsx'),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
