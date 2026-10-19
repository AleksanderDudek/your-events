import CityPickerView from '@/components/views/CityPickerView/CityPickerView';
import { buildMeta } from '@/lib/seo';

export const meta = () => buildMeta({ canonicalPath: '/' });

export default function HomePage() {
  return <CityPickerView />;
}
