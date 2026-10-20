import type { Metadata } from 'next';
import MyFiltersView from '@/components/views/MyFiltersView/MyFiltersView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { SITE_URL } from '@/config/site';
import { MY_FILTERS_PATH } from '@/config/community';

// City-agnostic like /rozwijaj-z-nami: a preset carries its own city, so this
// page sits outside the /{city} subtree. A static segment resolves ahead of the
// dynamic one, so no city id can shadow it.
const m = messages[DEFAULT_LOCALE];

export const metadata: Metadata = {
  title: m.PRESETS_META_TITLE,
  description: m.PRESETS_META_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${MY_FILTERS_PATH}` },
  // The content is whatever the visitor saved in their own browser — there is
  // nothing here for a crawler to index, and a search result pointing at an
  // empty state would be a poor one.
  robots: { index: false, follow: true },
};

export default function MyFiltersPage() {
  return <MyFiltersView />;
}
