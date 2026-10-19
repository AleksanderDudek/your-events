import PrivacyView from '@/components/views/PrivacyView/PrivacyView';
import { PRIVACY_PATH } from '@/config/community';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { buildMeta } from '@/lib/seo';

const m = messages[DEFAULT_LOCALE];

export const meta = () =>
  buildMeta({
    title: m.PRIVACY_META_TITLE,
    description: m.PRIVACY_META_DESCRIPTION,
    canonicalPath: PRIVACY_PATH,
  });

export default function PrivacyPage() {
  return <PrivacyView />;
}
