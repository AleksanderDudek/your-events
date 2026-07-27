'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useEvents, useMapEvents } from '@/components/service/useEvents';
import { useCategories } from '@/components/service/useCategories';
import FilterPanel from '@/components/common/FilterPanel/FilterPanel';
import EventGrid from '@/components/common/EventGrid/EventGrid';
import EventGridSkeleton from '@/components/common/EventGrid/EventGridSkeleton';
import EventList from '@/components/common/EventList/EventList';
import EventListSkeleton from '@/components/common/EventList/EventListSkeleton';
import ViewToggle from '@/components/common/ViewToggle/ViewToggle';
import SavePresetButton from '@/components/common/SavePresetButton/SavePresetButton';
import EventsMap from '@/components/common/EventsMap/EventsMap';
import AppPagination from '@/components/common/AppPagination/AppPagination';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import ErrorState from '@/components/ui/ErrorState/ErrorState';
import { useCity } from '@/config/CityProvider';
import { useFilterNavigation } from '@/components/service/useFilterNavigation';
import { countActiveFilters } from '@/lib/filterUtils';
import { PAGE_SIZE_OPTIONS, withBasePath } from '@/lib/constants';
import { eventPath } from '@/lib/slug';
import { useTranslation } from '@/i18n';
import { PageSize, ViewMode, EventFilters } from '@/types/filter.types';
import { Event } from '@/types/event.types';
import styles from './EventsListView.module.scss';

function renderBody({
  events,
  mapEvents,
  isLoading,
  filters,
  clearAll,
  mapCenter,
  mapEmptyMessage,
  citySlug,
  displayNameToSlug,
  mapPopupCta,
  mapLoading,
}: {
  events: Event[];
  mapEvents: Event[];
  mapLoading: boolean;
  isLoading: boolean;
  filters: EventFilters;
  clearAll: () => void;
  mapCenter: { lat: number; lng: number };
  mapEmptyMessage: string;
  citySlug: string;
  displayNameToSlug: Map<string, string>;
  mapPopupCta: string;
}) {
  // Initial fetch (no data cached yet) → render shape-matching skeletons sized
  // to the user's chosen pageSize so the page doesn't reflow when data lands.
  // The map runs its own query, so it has to answer "still loading?" and "found
  // nothing?" from that one — the list's page could be empty or full without
  // saying anything about how many pins there are.
  if (filters.viewMode === 'map') {
    if (mapLoading && mapEvents.length === 0) return null;
    if (mapEvents.length === 0) {
      return <EmptyState onClear={countActiveFilters(filters) > 0 ? clearAll : undefined} />;
    }
  } else {
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
  }

  if (filters.viewMode === 'map') {
    // Pins come from their own query — every match, not the page the list is on
    // — so paging must not thin them out here. The coordinate check is belt and
    // braces: fetchMapEvents already excludes rows without one.
    const withCoords = mapEvents.filter(
      (e) => e.location.lat !== null && e.location.lng !== null
    );
    if (withCoords.length === 0) {
      return (
        <Typography
          variant="body2"
          sx={{ color: 'var(--color-text-secondary)', py: 4, textAlign: 'center' }}
        >
          {mapEmptyMessage}
        </Typography>
      );
    }
    return (
      <EventsMap
        events={withCoords}
        center={mapCenter}
        zoom={12}
        height={620}
        fitToEvents
        renderPopup={(ev) => {
          const safeName = ev.name.replace(/</g, '&lt;');
          const safeVenue = ev.location.name?.replace(/</g, '&lt;') ?? '';
          // Leaflet popups render raw HTML outside React, so basePath is applied
          // manually; the trailing slash matches the static export's route
          // (trailingSlash: true) so the link resolves without a redirect.
          const href = `${withBasePath(eventPath(citySlug, ev, displayNameToSlug))}/`;
          const arrow =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
          return (
            `<strong style="display:block;font-size:0.875rem;margin-bottom:2px;">${safeName}</strong>` +
            (safeVenue ? `<span style="color:#6b7280;">${safeVenue}</span>` : '') +
            `<a href="${href}" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;padding:7px 12px;border-radius:8px;background:#ec4899;color:#fff;font-weight:600;font-size:0.8125rem;text-decoration:none;">${mapPopupCta}${arrow}</a>`
          );
        }}
      />
    );
  }
  return filters.viewMode === 'grid' ? <EventGrid events={events} /> : <EventList events={events} />;
}

export default function EventsListView() {
  const { events, total, isLoading, isError, isFetching, refetch, filters } = useEvents();
  // Fetched only while the map is on screen; it is the whole result set, not a
  // page of it.
  const isMapView = filters.viewMode === 'map';
  const {
    events: mapEvents,
    total: mapTotal,
    isLoading: mapLoading,
    isFetching: mapFetching,
  } = useMapEvents(isMapView);
  const { bySlug, displayNameToSlug } = useCategories();
  const { city } = useCity();
  const { t } = useTranslation();
  const {
    readCurrentFilters,
    updateFilters: updateFilter,
    updatePagination,
    clearFilters: clearAll,
  } = useFilterNavigation();

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
            {/* The pin count visibly disagreeing with the result count needs a
                stated reason — events with no coordinates cannot be placed. */}
            {isMapView && !mapLoading && mapTotal < total && (
              <Typography variant="body2" sx={{ color: 'var(--color-text-muted)' }}>
                {t.MAP_SHOWN_OF_TOTAL(mapTotal, total)}
              </Typography>
            )}
            {((isFetching && !isLoading) || (isMapView && mapFetching && !mapLoading)) && (
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
            {/* Only offered once there is something worth keeping — saving the
                unfiltered list would just be a link to the list. */}
            {countActiveFilters(filters) > 0 && (
              <SavePresetButton filters={filters} cityId={city.id} />
            )}
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
          {renderBody({
            events,
            mapEvents,
            isLoading,
            filters,
            clearAll,
            mapCenter: city.coordinates,
            mapEmptyMessage: t.MAP_EVENT_NO_PINS,
            citySlug: city.id,
            displayNameToSlug,
            mapPopupCta: t.MAP_POPUP_CTA,
            mapLoading: mapLoading,
          })}
        </Box>

        {filters.viewMode !== 'map' && (
          <AppPagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            onPageChange={(page) => updatePagination({ page })}
            onPageSizeChange={(pageSize) => updateFilter({ pageSize })}
          />
        )}
      </Box>
    </Box>
  );
}
