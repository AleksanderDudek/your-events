import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';

// Emitted as 404.html by the static export. NotFoundRedirect reads the current
// path client-side and sends the user to /{city}/wydarzenia when the URL starts
// with a valid city, otherwise to the city picker.
export default function NotFound() {
  return <NotFoundRedirect />;
}
