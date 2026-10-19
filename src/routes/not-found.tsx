import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';
import { buildMeta } from '@/lib/seo';

export const meta = () => buildMeta({ robots: 'noindex' });

// Any path no other route matches. NotFoundRedirect reads the path and sends
// the visitor to /{city}/wydarzenia when it starts with a valid city, otherwise
// to the city picker.
export default function NotFound() {
  return <NotFoundRedirect />;
}
