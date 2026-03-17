'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useEvents } from '@/components/service/useEvents';
import FilterPanel from '@/components/common/FilterPanel/FilterPanel';
import EventGrid from '@/components/common/EventGrid/EventGrid';
import EventList from '@/components/common/EventList/EventList';
import ViewToggle from '@/components/common/ViewToggle/ViewToggle';
import AppPagination from '@/components/common/AppPagination/AppPagination';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import ErrorState from '@/components/ui/ErrorState/ErrorState';
import { filtersToSearchParams, getDefaultFilters, countActiveFilters } from '@/lib/filterUtils';
import { CATEGORY_LABELS, SOURCE_TYPE_LABELS, PAGE_SIZE_OPTIONS } from '@/lib/constants';
import { S } from '@/lib/strings';
import { PageSize, ViewMode } from '@/types/filter.types';
import styles from './EventsListView.module.scss';

export default function EventsListView() {
  const { events, total, isLoading, isError, isFetching, refetch, filters } = useEvents();
  const router = useRouter();

  const updateFilter = useCallback(
    (updates: Record<string, unknown>) => {
      const newFilters = { ...filters, ...updates, page: 1 };
      const params = filtersToSearchParams(newFilters);
      router.push(`/events?${params.toString()}`);
    },
    [filters, router]
  );

  const updatePagination = useCallback(
    (updates: Record<string, unknown>) => {
      const newFilters = { ...filters, ...updates };
      const params = filtersToSearchParams(newFilters);
      router.push(`/events?${params.toString()}`);
    },
    [filters, router]
  );

  const clearAll = useCallback(() => {
    const defaults = getDefaultFilters();
    defaults.viewMode = filters.viewMode;
    defaults.pageSize = filters.pageSize;
    const params = filtersToSearchParams(defaults);
    router.push(`/events?${params.toString()}`);
  }, [filters.viewMode, filters.pageSize, router]);

  const activeChips: { key: string; label: string }[] = [];
  if (filters.search) {
    activeChips.push({ key: 'search', label: `"${filters.search}"` });
  }
  filters.categories.forEach((cat) => {
    activeChips.push({ key: `cat-${cat}`, label: CATEGORY_LABELS[cat] || cat });
  });
  filters.sourceTypes.forEach((src) => {
    activeChips.push({ key: `src-${src}`, label: SOURCE_TYPE_LABELS[src] || src });
  });
  if (filters.freeOnly) {
    activeChips.push({ key: 'free', label: S.FILTER_FREE_ONLY });
  }

  if (isError) {
    return (
      <Box className={styles.layout}>
        <FilterPanel />
        <Box className={styles.results}>
          <ErrorState onRetry={() => refetch()} />
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.layout}>
      <FilterPanel />

      <Box className={styles.results}>
        <Box className={styles.resultsHeader}>
          <Box className={styles.headerLeft}>
            <Typography
              variant="body2"
              aria-live="polite"
              sx={{ color: 'var(--color-text-secondary)' }}
            >
              {S.RESULTS_COUNT(total)}
            </Typography>
            {isFetching && !isLoading && (
              <CircularProgress size={16} sx={{ color: 'var(--color-accent-primary)', ml: 1 }} />
            )}
          </Box>

          <Box className={styles.headerRight}>
            <ViewToggle
              value={filters.viewMode}
              onChange={(viewMode: ViewMode) => updatePagination({ viewMode })}
            />
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={filters.pageSize}
                onChange={(e) =>
                  updateFilter({ pageSize: Number(e.target.value) as PageSize })
                }
                sx={{ fontSize: '0.8125rem' }}
                aria-label={S.PAGE_SIZE_LABEL}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {activeChips.length > 0 && (
          <Box className={styles.chipBar}>
            {activeChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                size="small"
                onDelete={() => {
                  if (chip.key === 'search') updateFilter({ search: '' });
                  else if (chip.key.startsWith('cat-')) {
                    const cat = chip.key.replace('cat-', '');
                    updateFilter({
                      categories: filters.categories.filter((c) => c !== cat),
                    });
                  } else if (chip.key.startsWith('src-')) {
                    const src = chip.key.replace('src-', '');
                    updateFilter({
                      sourceTypes: filters.sourceTypes.filter((s) => s !== src),
                    });
                  } else if (chip.key === 'free') {
                    updateFilter({ freeOnly: false });
                  }
                }}
                sx={{
                  backgroundColor: 'rgba(244, 162, 40, 0.12)',
                  color: 'var(--color-accent-primary)',
                  '& .MuiChip-deleteIcon': { color: 'var(--color-accent-primary)' },
                }}
              />
            ))}
          </Box>
        )}

        <Box className={styles.body}>
          {events.length === 0 && !isLoading ? (
            <EmptyState onClear={countActiveFilters(filters) > 0 ? clearAll : undefined} />
          ) : filters.viewMode === 'grid' ? (
            <EventGrid events={events} />
          ) : (
            <EventList events={events} />
          )}
        </Box>

        <AppPagination
          page={filters.page}
          pageSize={filters.pageSize}
          total={total}
          onPageChange={(page) => updatePagination({ page })}
          onPageSizeChange={(pageSize) => updateFilter({ pageSize })}
        />
      </Box>
    </Box>
  );
}
