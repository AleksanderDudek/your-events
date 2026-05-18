'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WeekendIcon from '@mui/icons-material/Weekend';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PaletteIcon from '@mui/icons-material/Palette';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import NightlifeIcon from '@mui/icons-material/Nightlife';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import AnimatedLastWord from '@/components/common/AnimatedLastWord/AnimatedLastWord';
import {
  buildArtUrl,
  buildDanceUrl,
  buildFoodUrl,
  buildNowUrl,
  buildSportNowUrl,
  buildTodayUrl,
  buildWeekendUrl,
} from '@/lib/homeFilters';
import styles from './HomeView.module.scss';

const FALLBACK_HREF = '/events' as Route;

interface CtaUrls {
  now: Route;
  today: Route;
  weekend: Route;
  sport: Route;
  art: Route;
  food: Route;
  dance: Route;
}

export default function HomeView() {
  const { t, locale } = useTranslation();
  const { city, isResolved } = useCity();
  // Until the city is resolved post-hydration, render the generic word so SSR
  // and the first paint match. Once resolved, the prop flips to the city's
  // accusative form and AnimatedLastWord animates the swap.
  const headlineLastWord = isResolved
    ? city.accusativeForm[locale]
    : t.HOME_HERO_HEADLINE_GENERIC_WORD;
  const cityLocative = city.locativeForm[locale];
  // CTA hrefs depend on the user's current Date, which would differ between
  // build-time SSR and client render. Ship the fallback in static HTML, then
  // upgrade once mounted so the URL on hover / right-click is correct.
  const [urls, setUrls] = useState<CtaUrls>({
    now: FALLBACK_HREF,
    today: FALLBACK_HREF,
    weekend: FALLBACK_HREF,
    sport: FALLBACK_HREF,
    art: FALLBACK_HREF,
    food: FALLBACK_HREF,
    dance: FALLBACK_HREF,
  });

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls({
      now: buildNowUrl(now) as Route,
      today: buildTodayUrl(now) as Route,
      weekend: buildWeekendUrl(now) as Route,
      sport: buildSportNowUrl(now) as Route,
      art: buildArtUrl(now) as Route,
      food: buildFoodUrl(now) as Route,
      dance: buildDanceUrl(now) as Route,
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
      key: 'today',
      href: urls.today,
      title: t.HOME_TODAY_TITLE,
      sub: t.HOME_TODAY_SUB,
      cta: t.HOME_TODAY_CTA,
      icon: <WbSunnyIcon />,
      className: styles.tileToday,
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
    {
      key: 'art',
      href: urls.art,
      title: t.HOME_ART_TITLE,
      sub: t.HOME_ART_SUB,
      cta: t.HOME_ART_CTA,
      icon: <PaletteIcon />,
      className: styles.tileArt,
    },
    {
      key: 'food',
      href: urls.food,
      title: t.HOME_FOOD_TITLE,
      sub: t.HOME_FOOD_SUB,
      cta: t.HOME_FOOD_CTA,
      icon: <RestaurantIcon />,
      className: styles.tileFood,
    },
    {
      key: 'dance',
      href: urls.dance,
      title: t.HOME_DANCE_TITLE,
      sub: t.HOME_DANCE_SUB,
      cta: t.HOME_DANCE_CTA,
      icon: <NightlifeIcon />,
      className: styles.tileDance,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.heroBlob} aria-hidden="true" />
      <div className={styles.heroBlobTwo} aria-hidden="true" />

      <div className={styles.hero}>
        <p className={styles.prompt}>{t.HOME_HERO_PROMPT}</p>
        <h1
          className={styles.headline}
          aria-label={`${t.HOME_HERO_HEADLINE_PREFIX} ${headlineLastWord}`}
        >
          <span className={styles.headlinePrefix} aria-hidden="true">
            {t.HOME_HERO_HEADLINE_PREFIX}
          </span>{' '}
          <span className={styles.headlineLastWord} aria-hidden="true">
            <AnimatedLastWord text={headlineLastWord} />
          </span>
        </h1>
        <p className={styles.heroSub}>{t.HOME_HERO_SUB(cityLocative)}</p>
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
