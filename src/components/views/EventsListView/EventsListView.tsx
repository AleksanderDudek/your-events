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
import { useCategories } from '@/components/service/useCategories';
import FilterPanel from '@/components/common/FilterPanel/FilterPanel';
import EventGrid from '@/components/common/EventGrid/EventGrid';
import EventGridSkeleton from '@/components/common/EventGrid/EventGridSkeleton';
import EventList from '@/components/common/EventList/EventList';
import EventListSkeleton from '@/components/common/EventList/EventListSkeleton';
import ViewToggle from '@/components/common/ViewToggle/ViewToggle';
import AppPagination from '@/components/common/AppPagination/AppPagination';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import ErrorState from '@/components/ui/ErrorState/ErrorState';
import {
  filtersToSearchParams,
  getDefaultFilters,
  countActiveFilters,
  parseFiltersFromParams,
} from '@/lib/filterUtils';
import { PAGE_SIZE_OPTIONS } from '@/lib/constants';
import { useTranslation } from '@/i18n';
import { PageSize, ViewMode, EventFilters } from '@/types/filter.types';
import { Event } from '@/types/event.types';
import styles from './EventsListView.module.scss';

function renderBody({
  events,
  isLoading,
  filters,
  clearAll,
}: {
  events: Event[];
  isLoading: boolean;
  filters: EventFilters;
  clearAll: () => void;
}) {
  // Initial fetch (no data cached yet) → render shape-matching skeletons sized
  // to the user's chosen pageSize so the page doesn't reflow when data lands.
  if (isLoading && events.length === 0) {
    return filters.viewMode === 'grid' ? (
      <EventGridSkeleton count={filters.pageSize} />
    ) : (
      <EventListSkeleton count={filters.pageSize} />
    );
  }
  if (events.length === 0) {
    return <EmptyState onClear={countActiveFilters(filters) > 0 ? clearAll : undefined} />;
  }
  return filters.viewMode === 'grid' ? <EventGrid events={events} /> : <EventList events={events} />;
}

export default function EventsListView() {
  const { events, total, isLoading, isError, isFetching, refetch, filters } = useEvents();
  const { bySlug } = useCategories();
  const { t } = useTranslation();
  const router = useRouter();

  // Always merge against the *live* URL, not a closure-captured snapshot.
  // Without this, rapid actions (e.g. delete chip → change page) racing the
  // next React render would merge into stale filters and undo each other.
  const readCurrentFilters = useCallback(() => {
    const live =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    return parseFiltersFromParams(live);
  }, []);

  const navigate = useCallback(
    (params: URLSearchParams) => {
      router.push(`/events?${params.toString()}`);
    },
    [router]
  );

  const updateFilter = useCallback(
    (updates: Record<string, unknown>) => {
      const newFilters = { ...readCurrentFilters(), ...updates, page: 1 };
      navigate(filtersToSearchParams(newFilters));
    },
    [readCurrentFilters, navigate]
  );

  const updatePagination = useCallback(
    (updates: Record<string, unknown>) => {
      const newFilters = { ...readCurrentFilters(), ...updates };
      navigate(filtersToSearchParams(newFilters));
    },
    [readCurrentFilters, navigate]
  );

  const clearAll = useCallback(() => {
    const current = readCurrentFilters();
    const defaults = getDefaultFilters();
    defaults.viewMode = current.viewMode;
    defaults.pageSize = current.pageSize;
    navigate(filtersToSearchParams(defaults));
  }, [readCurrentFilters, navigate]);

  const activeChips: { key: string; label: string }[] = [];
  if (filters.search) {
    activeChips.push({ key: 'search', label: `"${filters.search}"` });
  }
  filters.categories.forEach((cat) => {
    activeChips.push({ key: `cat-${cat}`, label: bySlug.get(cat)?.display_name ?? cat });
  });
  if (filters.freeOnly) {
    activeChips.push({ key: 'freeOnly', label: t.FILTER_FREE_ONLY });
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
              {t.RESULTS_COUNT(total)}
            </Typography>
            {isFetching && !isLoading && (
              <Box
                className={styles.loadingPill}
                role="status"
                aria-live="polite"
                aria-label={t.LOADING_EVENTS}
              >
                <CircularProgress size={12} thickness={5} sx={{ color: 'var(--color-accent-primary)' }} />
                <Typography variant="caption" sx={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                  {t.LOADING_EVENTS}
                </Typography>
              </Box>
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
                SelectDisplayProps={{ 'aria-label': t.PAGE_SIZE_LABEL }}
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
                  else if (chip.key === 'freeOnly') updateFilter({ freeOnly: false });
                  else if (chip.key.startsWith('cat-')) {
                    const cat = chip.key.replace('cat-', '');
                    updateFilter({
                      categories: readCurrentFilters().categories.filter((c) => c !== cat),
                    });
                  }
                }}
                sx={{
                  backgroundColor: 'var(--color-accent-tint)',
                  color: 'var(--color-accent-primary)',
                  '& .MuiChip-deleteIcon': { color: 'var(--color-accent-primary)' },
                }}
              />
            ))}
          </Box>
        )}

        <Box
          className={`${styles.body}${isFetching && !isLoading ? ` ${styles.bodyRefetching}` : ''}`}
        >
          {renderBody({ events, isLoading, filters, clearAll })}
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
