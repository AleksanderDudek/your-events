'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import WeekendIcon from '@mui/icons-material/Weekend';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import { useTranslation } from '@/i18n';
import { buildNowUrl, buildSportNowUrl, buildWeekendUrl } from '@/lib/homeFilters';
import styles from './HomeView.module.scss';

const FALLBACK_HREF = '/events' as Route;

interface CtaUrls {
  now: Route;
  weekend: Route;
  sport: Route;
}

export default function HomeView() {
  const { t } = useTranslation();
  // CTA hrefs depend on the user's current Date, which would differ between
  // build-time SSR and client render. Ship the fallback in static HTML, then
  // upgrade once mounted so the URL on hover / right-click is correct.
  const [urls, setUrls] = useState<CtaUrls>({
    now: FALLBACK_HREF,
    weekend: FALLBACK_HREF,
    sport: FALLBACK_HREF,
  });

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls({
      now: buildNowUrl(now) as Route,
      weekend: buildWeekendUrl(now) as Route,
      sport: buildSportNowUrl(now) as Route,
    });
  }, []);

  const tiles = [
    {
      key: 'now',
      href: urls.now,
      title: t.HOME_NOW_TITLE,
      sub: t.HOME_NOW_SUB,
      cta: t.HOME_NOW_CTA,
      icon: <BoltIcon />,
      className: styles.tileNow,
    },
    {
      key: 'weekend',
      href: urls.weekend,
      title: t.HOME_WEEKEND_TITLE,
      sub: t.HOME_WEEKEND_SUB,
      cta: t.HOME_WEEKEND_CTA,
      icon: <WeekendIcon />,
      className: styles.tileWeekend,
    },
    {
      key: 'sport',
      href: urls.sport,
      title: t.HOME_SPORT_TITLE,
      sub: t.HOME_SPORT_SUB,
      cta: t.HOME_SPORT_CTA,
      icon: <FitnessCenterIcon />,
      className: styles.tileSport,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.heroBlob} aria-hidden="true" />
      <div className={styles.heroBlobTwo} aria-hidden="true" />

      <div className={styles.hero}>
        <p className={styles.prompt}>{t.HOME_HERO_PROMPT}</p>
        <h1 className={styles.headline}>{t.HOME_HERO_HEADLINE}</h1>
        <p className={styles.heroSub}>{t.HOME_HERO_SUB}</p>
      </div>

      <section className={styles.tiles} aria-label={t.HOME_HERO_HEADLINE}>
        {tiles.map((tile) => (
          <Link key={tile.key} href={tile.href} className={`${styles.tile} ${tile.className}`}>
            <span className={styles.tileIcon} aria-hidden="true">
              {tile.icon}
            </span>
            <h2 className={styles.tileTitle}>{tile.title}</h2>
            <p className={styles.tileSub}>{tile.sub}</p>
            <span className={styles.tileCta}>
              <span>{tile.cta}</span>
              <ArrowForwardIcon fontSize="small" />
            </span>
          </Link>
        ))}
      </section>

      <div className={styles.browseAll}>
        <Button
          component={Link}
          href={'/events' as Route}
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          className={styles.browseAllButton}
        >
          {t.HOME_CTA_BROWSE_ALL}
        </Button>
      </div>
    </div>
  );
}
