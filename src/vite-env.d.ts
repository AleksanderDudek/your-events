/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

// Every variable the app reads at build time. Vite inlines VITE_* values into
// both the browser bundle and the prerender bundle, so they are public: never
// put a secret here. See src/config/env.ts for defaults and validation.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_SCHEMA?: string;
  readonly VITE_SITE_ORIGIN?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_ENABLED_CITIES?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;
  readonly VITE_ROBOTS_NOINDEX?: string;
  readonly VITE_ONBOARDING_ENABLED?: string;
  readonly VITE_SUPABASE_URL_WROCLAW?: string;
  readonly VITE_SUPABASE_ANON_KEY_WROCLAW?: string;
  readonly VITE_SUPABASE_URL_SZCZECIN?: string;
  readonly VITE_SUPABASE_ANON_KEY_SZCZECIN?: string;
  readonly VITE_SUPABASE_URL_WARSZAWA?: string;
  readonly VITE_SUPABASE_ANON_KEY_WARSZAWA?: string;
  readonly VITE_SUPABASE_URL_KRAKOW?: string;
  readonly VITE_SUPABASE_ANON_KEY_KRAKOW?: string;
  readonly VITE_SUPABASE_URL_LODZ?: string;
  readonly VITE_SUPABASE_ANON_KEY_LODZ?: string;
  readonly VITE_SUPABASE_URL_POZNAN?: string;
  readonly VITE_SUPABASE_ANON_KEY_POZNAN?: string;
  readonly VITE_SUPABASE_URL_GDANSK?: string;
  readonly VITE_SUPABASE_ANON_KEY_GDANSK?: string;
  readonly VITE_SUPABASE_URL_BYDGOSZCZ?: string;
  readonly VITE_SUPABASE_ANON_KEY_BYDGOSZCZ?: string;
  readonly VITE_SUPABASE_URL_TORUN?: string;
  readonly VITE_SUPABASE_ANON_KEY_TORUN?: string;
  readonly VITE_SUPABASE_URL_LUBLIN?: string;
  readonly VITE_SUPABASE_ANON_KEY_LUBLIN?: string;
  readonly VITE_SUPABASE_URL_KATOWICE?: string;
  readonly VITE_SUPABASE_ANON_KEY_KATOWICE?: string;
  readonly VITE_SUPABASE_URL_BIALYSTOK?: string;
  readonly VITE_SUPABASE_ANON_KEY_BIALYSTOK?: string;
  readonly VITE_SUPABASE_URL_KIELCE?: string;
  readonly VITE_SUPABASE_ANON_KEY_KIELCE?: string;
  readonly VITE_SUPABASE_URL_OLSZTYN?: string;
  readonly VITE_SUPABASE_ANON_KEY_OLSZTYN?: string;
  readonly VITE_SUPABASE_URL_RZESZOW?: string;
  readonly VITE_SUPABASE_ANON_KEY_RZESZOW?: string;
  readonly VITE_SUPABASE_URL_OPOLE?: string;
  readonly VITE_SUPABASE_ANON_KEY_OPOLE?: string;
  readonly VITE_SUPABASE_URL_GORZOW?: string;
  readonly VITE_SUPABASE_ANON_KEY_GORZOW?: string;
  readonly VITE_SUPABASE_URL_ZIELONA_GORA?: string;
  readonly VITE_SUPABASE_ANON_KEY_ZIELONA_GORA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
