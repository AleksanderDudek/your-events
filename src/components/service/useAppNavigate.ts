import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { withTrailingSlash } from '@/lib/href';

/**
 * Programmatic navigation to a site-relative path, with the same URL policy as
 * AppLink. The router adds the base path.
 */
export function useAppNavigate(): (path: string) => void {
  const navigate = useNavigate();
  return useCallback((path: string) => void navigate(withTrailingSlash(path)), [navigate]);
}
