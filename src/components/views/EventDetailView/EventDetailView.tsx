'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MapIcon from '@mui/icons-material/Map';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import AddToCalendar from '@/components/ui/AddToCalendar/AddToCalendar';
import EventsMap from '@/components/common/EventsMap/EventsMap';
import { formatDate, formatEventTime } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import styles from './EventDetailView.module.scss';

interface EventDetailViewProps {
  event: Event;
}

// Saturated gradients picked from the category palette so the hero block
// feels like the icon cards even when no event image is provided.
const GRADIENT_COLORS = [
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',  // pink → violet
  'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',  // orange → amber
  'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',  // cyan → violet
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',  // emerald → cyan
  'linear-gradient(135deg, #f472b6 0%, #f97316 100%)',  // rose → orange
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

// Hero background: real event image (poster / source logo) when available,
// otherwise the deterministic category gradient. Falls back to the gradient
// on image load error. The heroOverlay scrim keeps the title legible on top
// of either. `unoptimized` because next.config uses output:'export'.
function HeroBackground({ event }: { event: Event }) {
  const [errored, setErrored] = useState(false);
  if (event.imageUrl && !errored) {
    return (
      <Image
        src={event.imageUrl}
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 900px) 100vw, 900px"
        className={styles.heroImage}
        onError={() => setErrored(true)}
        unoptimized
        priority
      />
    );
  }
  return (
    <Box className={styles.heroGradient} sx={{ background: getGradient(event.id) }} />
  );
}

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Plain calendar date — locale-agnostic and stable, avoids "X minutes ago" libs.
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EventDetailView({ event }: EventDetailViewProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);
  // Dedupe — some events have categoryMain === categorySub, which would
  // render two identical chips and collide on React keys.
  const categoryChips = Array.from(
    new Set([event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c)))
  );
  const description = event.description.trim();
  const priceLabel = event.price.label?.trim();
  const hasMap = event.location.lat !== null && event.location.lng !== null;
  // Only Google Maps: the OSM link duplicated the map already embedded below it.
  const googleMapsUrl = hasMap
    ? `https://www.google.com/maps/search/?api=1&query=${event.location.lat},${event.location.lng}`
    : null;
  const hasUrl = Boolean(event.url);
  const updatedAt = formatUpdatedAt(event.updatedAt);

  return (
    <Box className={styles.container}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.back()}
        className={styles.backButton}
        sx={{ color: 'var(--color-text-secondary)', mb: 2, textTransform: 'none' }}
      >
        {t.BACK}
      </Button>

      {/* Hero */}
      <Box className={styles.hero}>
        <HeroBackground event={event} />
        <Box className={styles.heroOverlay}>
          <Typography
            variant="h3"
            component="h1"
            className={styles.heroTitle}
            sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}
          >
            {event.name}
          </Typography>
        </Box>
      </Box>

      {/* Detail grid */}
      <Box className={styles.detailGrid}>
        <Box className={styles.detailMain}>
          {/* Date + Time combined into a single compact line */}
          <Box className={styles.detailRow}>
            <CalendarTodayIcon className={styles.detailIcon} />
            <Box className={styles.detailRowBody}>
              <Typography variant="caption" className={styles.detailLabel}>
                {t.DETAIL_DATE}
              </Typography>
              <Typography className={styles.detailValue} sx={{ fontFamily: 'var(--font-mono)' }}>
                {formatDate(event.date)}
                {time && (
                  <>
                    <Box component="span" className={styles.metaSeparator} aria-hidden="true">
                      ·
                    </Box>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AccessTimeIcon sx={{ fontSize: '0.95em' }} />
                      {time}
                    </Box>
                  </>
                )}
              </Typography>
            </Box>
          </Box>

          {/* Location */}
          <Box className={styles.detailRow}>
            <PlaceIcon className={styles.detailIcon} />
            <Box className={styles.detailRowBody}>
              <Typography variant="caption" className={styles.detailLabel}>
                {t.DETAIL_LOCATION}
              </Typography>
              <Typography className={styles.detailValue}>{event.location.name}</Typography>
              {event.location.city && (
                <Typography variant="body2" className={styles.detailSub}>
                  {event.location.city}
                </Typography>
              )}
              {hasMap && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    href={googleMapsUrl as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<MapIcon />}
                    sx={{ textTransform: 'none', color: '#fff' }}
                  >
                    {t.OPEN_IN_GOOGLE_MAPS}
                  </Button>
                </Box>
              )}
              {hasMap && (
                <Box sx={{ mt: 1.5 }}>
                  <EventsMap
                    events={[event]}
                    center={{
                      lat: event.location.lat as number,
                      lng: event.location.lng as number,
                    }}
                    zoom={15}
                    height={260}
                    disableClustering
                  />
                </Box>
              )}
            </Box>
          </Box>

          {/* Categories */}
          {categoryChips.length > 0 && (
            <Box className={styles.detailSection}>
              <Typography variant="caption" className={styles.detailLabel} sx={{ display: 'block', mb: 0.75 }}>
                {t.DETAIL_CATEGORIES}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {categoryChips.map((cat) => (
                  <CategoryChip key={cat} category={cat} />
                ))}
              </Box>
            </Box>
          )}

          {/* Description — only when present */}
          {description && (
            <>
              <Divider sx={{ borderColor: 'var(--color-border)', my: { xs: 1.5, md: 2 } }} />
              <Box className={styles.detailSection}>
                <Typography variant="caption" className={styles.detailLabel} sx={{ display: 'block', mb: 0.75 }}>
                  {t.DETAIL_DESCRIPTION}
                </Typography>
                <Typography
                  className={styles.description}
                  sx={{ color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}
                >
                  {description}
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Sidebar info — appears under hero on mobile via CSS order */}
        <Box className={styles.detailSidebar}>
          <Box className={styles.infoCard}>
            <Box className={styles.priceCtaRow}>
              {/* Price */}
              <Box className={styles.infoRow}>
                <Typography variant="caption" className={styles.detailLabel}>
                  {t.DETAIL_PRICE}
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <PriceLabel amount={event.price.amount} currency={event.price.currency} label={event.price.label} showLabel={event.price.showLabel} />
                  {priceLabel && !event.price.showLabel && event.price.amount === null && (
                    <Typography variant="caption" display="block" sx={{ color: 'var(--color-text-muted)', mt: 0.25 }}>
                      {priceLabel}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* External Link — only when the source URL is real */}
              {hasUrl && (
                <Button
                  variant="contained"
                  color="primary"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewIcon />}
                  className={styles.externalLink}
                  sx={{ minHeight: 44 }}
                >
                  {t.EXTERNAL_LINK}
                </Button>
              )}

              {/* Secondary CTA: the ticket link stays the primary action. */}
              <Box className={styles.externalLink}>
                <AddToCalendar event={event} />
              </Box>
            </Box>

            {/* Sources */}
            {event.sources.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'var(--color-border)', my: { xs: 1.25, md: 2 } }} />
                <Box className={styles.infoRow}>
                  <Typography variant="caption" className={styles.detailLabel} sx={{ display: 'block', mb: 0.75 }}>
                    {t.LISTED_ON}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {event.sources.map((source) => (
                      <Chip
                        key={source}
                        label={source}
                        size="small"
                        sx={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.6875rem',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {updatedAt && (
              <Typography
                variant="caption"
                sx={{ color: 'var(--color-text-muted)', display: 'block', mt: 1.5, textAlign: 'center' }}
              >
                {t.LAST_UPDATED(updatedAt)}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
