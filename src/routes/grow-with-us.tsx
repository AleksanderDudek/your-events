import GrowWithUsView from '@/components/views/GrowWithUsView/GrowWithUsView';
import { GROW_WITH_US_PATH } from '@/config/community';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { buildMeta } from '@/lib/seo';

const m = messages[DEFAULT_LOCALE];

export const meta = () =>
  buildMeta({
    title: m.GROW_META_TITLE,
    description: m.GROW_META_DESCRIPTION,
    canonicalPath: GROW_WITH_US_PATH,
  });

export default function GrowWithUsPage() {
  return <GrowWithUsView />;
}
