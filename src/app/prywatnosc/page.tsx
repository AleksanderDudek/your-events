import type { Metadata } from 'next';
import PrivacyView from '@/components/views/PrivacyView/PrivacyView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { SITE_URL } from '@/config/site';
import { PRIVACY_PATH } from '@/config/community';

// Static metadata (no params to await): like the rest of the export, the SEO
// tags ship in DEFAULT_LOCALE.
const m = messages[DEFAULT_LOCALE];

export const metadata: Metadata = {
  title: m.PRIVACY_META_TITLE,
  description: m.PRIVACY_META_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${PRIVACY_PATH}` },
  openGraph: {
    title: m.PRIVACY_META_TITLE,
    description: m.PRIVACY_META_DESCRIPTION,
    type: 'website',
  },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
