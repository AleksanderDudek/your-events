'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
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
import { EventFilters } from '@/types/filter.types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  countActiveFilters,
  getDefaultFilters,
} from '@/lib/filterUtils';
import { useTranslation } from '@/i18n';
import { useCategories } from '@/components/service/useCategories';
import SearchInput from '@/components/ui/SearchInput/SearchInput';
import DateRangePicker from '@/components/ui/DateRangePicker/DateRangePicker';
import HourRangePicker from '@/components/ui/HourRangePicker/HourRangePicker';
import styles from './FilterPanel.module.scss';

export default function FilterPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const activeCount = countActiveFilters(filters);
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { topLevel, byParent } = useCategories();

  const toggleExpanded = useCallback((slug: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // Always merge against the *live* URL, not a closure-captured snapshot.
  // Without this, a quick "Clear → re-select category" sequence would merge
  // the new category back into the pre-clear filters (because React hasn't
  // re-rendered FilterPanel yet), resurrecting the date/hour filters the
  // user just cleared.
  const readCurrentFilters = useCallback(() => {
    const live =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    return parseFiltersFromParams(live);
  }, []);

  const updateFilters = useCallback(
    (updates: Partial<EventFilters>) => {
      const newFilters = { ...readCurrentFilters(), ...updates, page: 1 };
      const params = filtersToSearchParams(newFilters);
      router.push(`/events?${params.toString()}`);
    },
    [readCurrentFilters, router]
  );

  const clearFilters = useCallback(() => {
    const current = readCurrentFilters();
    const defaults = getDefaultFilters();
    defaults.viewMode = current.viewMode;
    defaults.pageSize = current.pageSize;
    const params = filtersToSearchParams(defaults);
    router.push(`/events?${params.toString()}`);
  }, [readCurrentFilters, router]);

  const handleCategoryToggle = useCallback(
    (slug: string) => {
      const current = readCurrentFilters();
      const cats = current.categories.includes(slug)
        ? current.categories.filter((c) => c !== slug)
        : [...current.categories, slug];
      updateFilters({ categories: cats });
    },
    [readCurrentFilters, updateFilters]
  );

  const filterContent = (
    <Box className={styles.content} aria-label={t.FILTER_TITLE} role="search">
      <Box className={styles.header}>
        <Typography variant="h6" component="p" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t.FILTER_TITLE}
        </Typography>
        {activeCount > 0 && (
          <Button size="small" onClick={clearFilters} sx={{ color: 'var(--color-accent-primary)' }}>
            {t.FILTER_CLEAR}
          </Button>
        )}
      </Box>

      <Box className={styles.section}>
        <SearchInput
          value={filters.search}
          onChange={(search) => updateFilters({ search })}
        />
      </Box>

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
                          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{cat.icon}</span>
                          <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                            {cat.display_name}
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
                              {sub.display_name}
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

      <Divider sx={{ borderColor: 'var(--color-border)' }} />

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
            onDateModeChange={(dateMode) => updateFilters({ dateMode })}
            onDateSingleChange={(dateSingle) => updateFilters({ dateSingle })}
            onDateFromChange={(dateFrom) => updateFilters({ dateFrom })}
            onDateToChange={(dateTo) => updateFilters({ dateTo })}
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
    </Box>
  );

  if (isMdUp) {
    return <Box className={styles.sidebar}>{filterContent}</Box>;
  }

  return (
    <>
      <Fab
        color="primary"
        onClick={() => setDrawerOpen(true)}
        className={styles.fab}
        aria-label={t.FILTER_TRIGGER(activeCount)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <Badge badgeContent={activeCount || undefined} color="error">
          <FilterListIcon />
        </Badge>
      </Fab>

      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            maxHeight: '85vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        <Box className={styles.dragHandle} />
        <Box sx={{ overflow: 'auto', pb: 10 }}>{filterContent}</Box>
        <Box className={styles.drawerFooter}>
          <Button
            variant="outlined"
            onClick={() => {
              clearFilters();
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
      </Drawer>
    </>
  );
}
