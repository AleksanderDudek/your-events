'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { DbCategory } from '@/types/event.types';

export function useCategories() {
  const { data, isLoading, isError } = useQuery({
    queryKey: eventsKeys.categories(),
    queryFn: () => fetchCategories(),
    staleTime: Infinity,
  });

  const categories = useMemo(() => (data ?? []) as DbCategory[], [data]);

  const topLevel = useMemo(
    () => categories.filter(c => c.parent_slug === null),
    [categories]
  );

  const bySlug = useMemo(
    () => new Map(categories.map(c => [c.slug, c])),
    [categories]
  );

  const byParent = useMemo(() => {
    const map = new Map<string, DbCategory[]>();
    categories
      .filter(c => c.parent_slug !== null)
      .forEach(c => {
        const list = map.get(c.parent_slug!) ?? [];
        map.set(c.parent_slug!, [...list, c]);
      });
    return map;
  }, [categories]);

  // events.category_main stores top-level display_name (e.g. "Taniec"), not slug.
  // Index top-level categories by display_name so components can resolve color/icon
  // from event.categoryMain directly.
  const byDisplayName = useMemo(() => {
    const map = new Map<string, DbCategory>();
    categories.forEach(c => {
      if (c.parent_slug === null) map.set(c.display_name, c);
    });
    return map;
  }, [categories]);

  const displayNameToSlug = useMemo(
    () => new Map(topLevel.map((c) => [c.display_name, c.slug])),
    [topLevel]
  );

  return { categories, topLevel, bySlug, byParent, byDisplayName, displayNameToSlug, isLoading, isError };
}
