import type { Metadata } from 'next';
import GrowWithUsView from '@/components/views/GrowWithUsView/GrowWithUsView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { SITE_URL } from '@/config/site';
import { GROW_WITH_US_PATH } from '@/config/community';

// Static metadata (no params to await): the page is city-agnostic and, like the
// rest of the export, ships its SEO tags in DEFAULT_LOCALE.
const m = messages[DEFAULT_LOCALE];

export const metadata: Metadata = {
  title: m.GROW_META_TITLE,
  description: m.GROW_META_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${GROW_WITH_US_PATH}` },
  openGraph: {
    title: m.GROW_META_TITLE,
    description: m.GROW_META_DESCRIPTION,
    type: 'website',
  },
};

export default function GrowWithUsPage() {
  return <GrowWithUsView />;
}
