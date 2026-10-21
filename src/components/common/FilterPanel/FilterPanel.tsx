'use client';

import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Badge from '@mui/material/Badge';
import Fab from '@mui/material/Fab';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { countActiveFilters } from '@/lib/filterUtils';
import { toggleCategorySelection } from '@/lib/categorySelection';
import { useTranslation } from '@/i18n';
import { Translated } from '@/i18n/translation';
import { useCategories } from '@/components/service/useCategories';
import { useFilterNavigation } from '@/components/service/useFilterNavigation';
import SearchInput from '@/components/ui/SearchInput/SearchInput';
import DateRangePicker, { DatePatch } from '@/components/ui/DateRangePicker/DateRangePicker';
import HourRangePicker from '@/components/ui/HourRangePicker/HourRangePicker';
import WeekdayPicker from '@/components/ui/WeekdayPicker/WeekdayPicker';
import CategoryIcon from '@/components/ui/CategoryIcon/CategoryIcon';
import NearbyFilter from '@/components/common/NearbyFilter/NearbyFilter';
import { categoryColorVar } from '@/lib/utils';
import styles from './FilterPanel.module.scss';

export default function FilterPanel() {
  const { filters, readCurrentFilters, updateFilters, clearFilters, clearFiltersExceptSearch } =
    useFilterNavigation();
  const activeCount = countActiveFilters(filters);
  // The phone drawer has no search box — it sits on the page — so what the
  // drawer counts (on its trigger, behind its clear button) leaves it out.
  const drawerCount = activeCount - (filters.search ? 1 : 0);
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Crossing into the sidebar layout (a tablet turned sideways) unmounts the
  // drawer but not this flag, and crossing back would reopen it unasked. Reset
  // during render rather than in an effect, so that never paints.
  if (isMdUp && drawerOpen) setDrawerOpen(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Bumped on "clear filters" to remount SearchInput. The box keeps the typed
  // text in local state (it debounces), and when the term never made it into the
  // URL there is no prop change to reset it from — remounting is what actually
  // empties the field and kills any in-flight debounce.
  const [resetToken, setResetToken] = useState(0);

  const { topLevel, byParent, bySlug } = useCategories();

  const toggleExpanded = useCallback((slug: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // Reset every filter AND every piece of panel-local state, so the panel looks
  // exactly like a first visit: no text in the search box, no expanded
  // subcategory lists.
  const handleClearAll = useCallback(() => {
    clearFilters();
    setExpanded(new Set());
    setResetToken((n) => n + 1);
  }, [clearFilters]);

  // The drawer's clear: everything the drawer shows, not the search box
  // outside it.
  const handleClearDrawer = useCallback(() => {
    clearFiltersExceptSearch();
    setExpanded(new Set());
  }, [clearFiltersExceptSearch]);

  const searchBox = (
    <SearchInput
      key={resetToken}
      value={filters.search}
      onChange={(search) => updateFilters({ search })}
    />
  );

  const handleCategoryToggle = useCallback(
    (slug: string) => {
      const current = readCurrentFilters();
      updateFilters({
        categories: toggleCategorySelection(current.categories, slug, bySlug),
      });
    },
    [bySlug, readCurrentFilters, updateFilters]
  );

  // Dropping the date mode must drop the hour range too: it only applies within
  // a chosen date, and a leftover hour would linger invisibly in the URL.
  const handleDateChange = useCallback(
    (patch: DatePatch) => {
      updateFilters(
        patch.dateMode === null ? { ...patch, hourFrom: null, hourTo: null } : patch
      );
    },
    [updateFilters]
  );

  const renderContent = (inSidebar: boolean) => (
    <Box className={styles.content} aria-label={t.FILTER_TITLE} role="search">
      <Box className={styles.header}>
        <Typography variant="h6" component="p" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t.FILTER_TITLE}
        </Typography>
        {(inSidebar ? activeCount : drawerCount) > 0 && (
          <Button
            size="small"
            onClick={inSidebar ? handleClearAll : handleClearDrawer}
            sx={{ color: 'var(--color-accent-primary)' }}
          >
            {t.FILTER_CLEAR}
          </Button>
        )}
      </Box>

      {/* On a phone the search box sits on the page instead (see below). */}
      {inSidebar && (
        <>
          {/* data-tour marks the onboarding spotlight's anchor — see lib/tourSteps. */}
          <Box className={styles.section} data-tour="search">
            {searchBox}
          </Box>

          <Divider sx={{ borderColor: 'var(--color-border)' }} />
        </>
      )}

      {/* Date */}
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.dateMode ? 1 : undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_DATE}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails>
          <DateRangePicker
            dateMode={filters.dateMode}
            dateSingle={filters.dateSingle}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={handleDateChange}
          />
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: 'var(--color-border)' }} />

      {/* Weekdays — stands on its own, unlike the hour range, so it is never
          disabled by the absence of a date mode. */}
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.weekdays.length || undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_WEEKDAYS}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails>
          <WeekdayPicker
            value={filters.weekdays}
            onChange={(weekdays) => updateFilters({ weekdays })}
          />
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: 'var(--color-border)' }} />

      {/* Hour */}
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.hourFrom || filters.hourTo ? 1 : undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_HOUR}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails>
          <HourRangePicker
            hourFrom={filters.hourFrom}
            hourTo={filters.hourTo}
            disabled={!filters.dateMode}
            onHourFromChange={(hourFrom) => updateFilters({ hourFrom })}
            onHourToChange={(hourTo) => updateFilters({ hourTo })}
          />
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: 'var(--color-border)' }} />

      {/* Nearby. Mounted only while open: it holds a geocoder query and a
          slider nobody needs until they ask for a place. */}
      <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.near ? 1 : undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_NEAR}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails>
          <NearbyFilter value={filters.near} onChange={(near) => updateFilters({ near })} />
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: 'var(--color-border)' }} />

      {/* Categories */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.categories.length || undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_CATEGORIES}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {topLevel.map(cat => {
              const children = byParent.get(cat.slug) ?? [];
              const isExp = expanded.has(cat.slug);
              return (
                <Box key={cat.slug}>
                  <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.categories.includes(cat.slug)}
                          onChange={() => handleCategoryToggle(cat.slug)}
                          sx={{
                            color: 'var(--color-border)',
                            '&.Mui-checked': { color: 'var(--color-accent-primary)' },
                            padding: '4px',
                          }}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {/* categoryColorVar/CategoryIcon key off the Polish
                              display_name below — only the visible label,
                              via <Translated/>, goes through the translator. */}
                          <Box
                            component="span"
                            sx={{ color: categoryColorVar(cat.display_name), display: 'inline-flex' }}
                          >
                            <CategoryIcon category={cat.display_name} size={18} />
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                            <Translated text={cat.display_name} />
                          </Typography>
                        </Box>
                      }
                      sx={{ flex: 1, m: 0 }}
                    />
                    {children.length > 0 && (
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(cat.slug)}
                        aria-label={isExp ? t.FILTER_COLLAPSE : t.FILTER_EXPAND}
                        sx={{ color: 'var(--color-text-muted)', mr: 0.5 }}
                      >
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 16,
                            transform: isExp ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </IconButton>
                    )}
                  </Box>

                  {isExp && children.length > 0 && (
                    <Box sx={{ pl: 4, pb: 0.5 }}>
                      {children.map(sub => (
                        <FormControlLabel
                          key={sub.slug}
                          control={
                            <Checkbox
                              size="small"
                              checked={filters.categories.includes(sub.slug)}
                              onChange={() => handleCategoryToggle(sub.slug)}
                              sx={{
                                color: 'var(--color-border)',
                                '&.Mui-checked': { color: 'var(--color-accent-primary)' },
                                padding: '2px 4px',
                              }}
                            />
                          }
                          label={
                            <Typography
                              variant="body2"
                              sx={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                            >
                              <Translated text={sub.display_name} />
                            </Typography>
                          }
                          sx={{ m: 0, display: 'flex' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );

  if (isMdUp) {
    return (
      <Box className={styles.sidebar} data-tour="filters">
        {renderContent(true)}
      </Box>
    );
  }

  return (
    <>
      {/* The search box, on the page rather than in the drawer. A server
          render cannot know the breakpoint (useMediaQuery answers false
          there — `next dev` renders this branch for desktop until hydration),
          so the CSS hides it from md up rather than show it and shift the list. */}
      <Box className={styles.pageSearch} role="search" aria-label={t.SEARCH_LABEL}>
        {searchBox}
      </Box>

      {/* Same tour anchor as the desktop sidebar: only one of the two is ever
          mounted, so the step follows whichever layout the visitor is in.
          Labelled, large and centred: a bare icon in a corner was easy to
          miss, and the middle is equally in reach of either thumb. */}
      {/* data-floating-filters: the footer keeps room for this button while
          it exists — see AppFooter.module.scss. */}
      <Fab
        variant="extended"
        color="primary"
        data-tour="filters"
        data-floating-filters=""
        onClick={() => setDrawerOpen(true)}
        aria-label={t.FILTER_TRIGGER(drawerCount)}
        sx={{
          position: 'fixed',
          insetInline: 0,
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 1000,
          width: 'max-content',
          height: 56,
          mx: 'auto',
          px: 3,
          gap: 1,
          fontSize: '1rem',
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <FilterListIcon sx={{ fontSize: 26 }} />
        {t.FILTER_TITLE}
        {drawerCount > 0 && (
          <span className={styles.fabCount} aria-hidden="true">
            {drawerCount}
          </span>
        )}
      </Fab>

      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        // The trigger opens it; the screen's bottom edge belongs to the system
        // (iOS's home indicator), not to a swipe-to-open.
        disableSwipeToOpen
        disableDiscovery
        // Close past 30% of the sheet's height — MUI's 52% is a long drag on a
        // sheet 85% of the screen tall — or on a quick flick. Scrolled content
        // scrolls back first; MUI hands it the gesture.
        hysteresis={0.3}
        // MUI keeps a swipeable drawer mounted so a swipe can open it. With
        // that off, a closed drawer leaves the page as before: no hidden copy
        // of every filter label for screen readers and tests to trip on.
        ModalProps={{ keepMounted: false }}
        PaperProps={{
          // MUI makes the paper a modal dialog; this is its name.
          'aria-label': t.FILTER_TITLE,
          sx: {
            maxHeight: '85vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        {/* The handle a thumb drags down to close the sheet. */}
        <Box className={styles.dragHandle} aria-hidden="true" />
        <Box>{renderContent(false)}</Box>
        <Box className={styles.drawerFooter}>
          <Button
            variant="outlined"
            onClick={() => {
              handleClearDrawer();
              setDrawerOpen(false);
            }}
            sx={{ flex: 1 }}
          >
            {t.FILTER_CLEAR}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setDrawerOpen(false)}
            sx={{ flex: 1 }}
          >
            {t.FILTER_APPLY}
          </Button>
        </Box>
      </SwipeableDrawer>
    </>
  );
}
