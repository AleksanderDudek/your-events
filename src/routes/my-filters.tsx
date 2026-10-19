import MyFiltersView from '@/components/views/MyFiltersView/MyFiltersView';
import { MY_FILTERS_PATH } from '@/config/community';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { buildMeta } from '@/lib/seo';

// City-agnostic like /rozwijaj-z-nami: a preset carries its own city, so this
// page sits outside the /:city subtree.
const m = messages[DEFAULT_LOCALE];

export const meta = () =>
  buildMeta({
    title: m.PRESETS_META_TITLE,
    description: m.PRESETS_META_DESCRIPTION,
    canonicalPath: MY_FILTERS_PATH,
    // The content is whatever the visitor saved in their own browser — there
    // is nothing here for a crawler to index, and a search result pointing at
    // an empty state would be a poor one.
    robots: 'noindex, follow',
  });

export default function MyFiltersPage() {
  return <MyFiltersView />;
}
