'use client';

import ErrorState from '@/components/ui/ErrorState/ErrorState';

export default function EventDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState onRetry={reset} />;
}
