'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import RepeatIcon from '@mui/icons-material/Repeat';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { formatDate, formatTimeRange } from '@/lib/utils';
import { AGE_GROUP_LABELS, SKILL_LEVEL_LABELS, SOURCE_TYPE_LABELS } from '@/lib/constants';
import { S } from '@/lib/strings';
import styles from './EventDetailView.module.scss';

interface EventDetailViewProps {
  event: Event;
}

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: S.RECURRENCE_WEEKLY,
  biweekly: S.RECURRENCE_BIWEEKLY,
  monthly: S.RECURRENCE_MONTHLY,
};

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #1a1a2e 0%, #2d1b3d 50%, #1a1a2e 100%)',
  'linear-gradient(135deg, #1a2a1a 0%, #2d3b1b 50%, #1a2a1a 100%)',
  'linear-gradient(135deg, #2a1a1a 0%, #3d2b1b 50%, #2a1a1a 100%)',
  'linear-gradient(135deg, #1a1a2a 0%, #1b2d3d 50%, #1a1a2a 100%)',
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

export default function EventDetailView({ event }: EventDetailViewProps) {
  const router = useRouter();

  return (
    <Box className={styles.container}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.back()}
        className={styles.backButton}
        sx={{ color: 'var(--color-text-secondary)', mb: 2, textTransform: 'none' }}
      >
        {S.BACK}
      </Button>

      {/* Hero */}
      <Box className={styles.hero}>
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.name}
            fill
            sizes="100vw"
            className={styles.heroImage}
            priority
          />
        ) : (
          <Box className={styles.heroGradient} sx={{ background: getGradient(event.id) }} />
        )}
        <Box className={styles.heroOverlay}>
          <Typography
            variant="h3"
            component="h1"
            className={styles.heroTitle}
            sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)' }}
          >
            {event.name}
          </Typography>
        </Box>
      </Box>

      {/* Status banner */}
      {event.status !== 'active' && (
        <Box className={styles.statusBanner}>
          <StatusBadge status={event.status} />
        </Box>
      )}

      {/* Detail grid */}
      <Box className={styles.detailGrid}>
        <Box className={styles.detailMain}>
          {/* Date/Time */}
          <Box className={styles.detailRow}>
            <CalendarTodayIcon className={styles.detailIcon} />
            <Box>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                {S.DETAIL_DATE}
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'var(--font-mono)' }}>
                {formatDate(event.date)}
              </Typography>
            </Box>
          </Box>

          <Box className={styles.detailRow}>
            <AccessTimeIcon className={styles.detailIcon} />
            <Box>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                {S.DETAIL_TIME}
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'var(--font-mono)' }}>
                {formatTimeRange(event.startTime, event.endTime)}
              </Typography>
            </Box>
          </Box>

          {/* Location */}
          <Box className={styles.detailRow}>
            <PlaceIcon className={styles.detailIcon} />
            <Box>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                {S.DETAIL_LOCATION}
              </Typography>
              <Typography variant="body1">{event.location.name}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                {event.location.address}, {event.location.city}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'var(--color-border)', my: 2 }} />

          {/* Categories */}
          <Box className={styles.detailSection}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-muted)', display: 'block', mb: 1 }}>
              {S.DETAIL_CATEGORIES}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {event.categories.map((cat) => (
                <CategoryChip key={cat} category={cat} />
              ))}
            </Box>
          </Box>

          {/* Tags */}
          {event.tags.length > 0 && (
            <Box className={styles.detailSection}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)', display: 'block', mb: 1 }}>
                {S.DETAIL_TAGS}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {event.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '0.75rem',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ borderColor: 'var(--color-border)', my: 2 }} />

          {/* Description */}
          <Box className={styles.detailSection}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-muted)', display: 'block', mb: 1 }}>
              {S.DETAIL_DESCRIPTION}
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'var(--color-text-primary)', lineHeight: 1.8 }}
            >
              {event.description}
            </Typography>
          </Box>
        </Box>

        {/* Sidebar info */}
        <Box className={styles.detailSidebar}>
          <Box className={styles.infoCard}>
            {/* Price */}
            <Box className={styles.infoRow}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                {S.DETAIL_PRICE}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <PriceLabel amount={event.price.amount} currency={event.price.currency} />
                {event.price.description && (
                  <Typography variant="caption" display="block" sx={{ color: 'var(--color-text-muted)', mt: 0.5 }}>
                    {event.price.description}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Age Group */}
            {event.ageGroup && (
              <Box className={styles.infoRow}>
                <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                  {S.DETAIL_AGE}
                </Typography>
                <Typography variant="body2">{AGE_GROUP_LABELS[event.ageGroup]}</Typography>
              </Box>
            )}

            {/* Level */}
            {event.level && (
              <Box className={styles.infoRow}>
                <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                  {S.DETAIL_LEVEL}
                </Typography>
                <Typography variant="body2">{SKILL_LEVEL_LABELS[event.level]}</Typography>
              </Box>
            )}

            {/* Instructor */}
            {event.instructor && (
              <Box className={styles.infoRow}>
                <PersonIcon sx={{ fontSize: 16, color: 'var(--color-text-muted)', mr: 0.5 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                    {S.DETAIL_INSTRUCTOR}
                  </Typography>
                  <Typography variant="body2">{event.instructor}</Typography>
                </Box>
              </Box>
            )}

            {/* Capacity */}
            {event.capacity && (
              <Box className={styles.infoRow}>
                <GroupIcon sx={{ fontSize: 16, color: 'var(--color-text-muted)', mr: 0.5 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                    {S.DETAIL_CAPACITY}
                  </Typography>
                  <Typography variant="body2">{event.capacity}</Typography>
                </Box>
              </Box>
            )}

            {/* Recurrence */}
            {event.isRecurring && event.recurrenceRule && (
              <Box className={styles.infoRow}>
                <RepeatIcon sx={{ fontSize: 16, color: 'var(--color-text-muted)', mr: 0.5 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                    {S.DETAIL_RECURRENCE}
                  </Typography>
                  <Typography variant="body2">
                    {RECURRENCE_LABELS[event.recurrenceRule] || event.recurrenceRule}
                  </Typography>
                </Box>
              </Box>
            )}

            <Divider sx={{ borderColor: 'var(--color-border)', my: 2 }} />

            {/* Source */}
            <Box className={styles.infoRow}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                {S.DETAIL_SOURCE}
              </Typography>
              <Typography variant="body2">{event.sourceName}</Typography>
              <Chip
                label={SOURCE_TYPE_LABELS[event.sourceType]}
                size="small"
                sx={{
                  mt: 0.5,
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.6875rem',
                }}
              />
            </Box>

            {/* External Link */}
            <Button
              variant="contained"
              color="primary"
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon />}
              fullWidth
              sx={{ mt: 2, minHeight: 44 }}
            >
              {S.EXTERNAL_LINK}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
