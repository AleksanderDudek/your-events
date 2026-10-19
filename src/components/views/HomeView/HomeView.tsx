import { useEffect, useState } from 'react';
import AppLink from '@/components/common/AppLink/AppLink';
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
import EventsMap from '@/components/common/EventsMap/EventsMap';
import { useEvents } from '@/components/service/useEvents';
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

interface CtaUrls {
  now: string;
  today: string;
  weekend: string;
  sport: string;
  art: string;
  food: string;
  dance: string;
}

// How long each side of the toggle lingers before the swap.
const HERO_CYCLE_MS = 2500;

export default function HomeView() {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  // Preview map below the CTA tiles. useEvents reads from the URL — on the
  // homepage that's empty, so this resolves to default filters (~15 events).
  const { events: previewEvents } = useEvents();
  // SSR renders the generic word so the static HTML stays stable. After
  // hydration we begin a two-state loop: the generic word ("miasto"/"town")
  // and the selected city's accusative form, alternating every HERO_CYCLE_MS.
  // The selected city is the only city ever shown; picking a different city
  // from the dropdown swaps the loop's "city side" but the toggle keeps going.
  const [showCity, setShowCity] = useState<boolean | null>(null);

  useEffect(() => {
    // Intentional: the prerendered HTML and the hydration pass show the
    // generic word; the loop may only start once we are in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCity(true);

    // Reduced-motion users see the selected city once and stop — no toggling.
    const mq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (mq?.matches) return;

    const id = window.setInterval(() => {
      setShowCity((prev) => !prev);
    }, HERO_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [city.id]);

  const headlineLastWord =
    showCity === true
      ? city.accusativeForm[locale]
      : t.HOME_HERO_HEADLINE_GENERIC_WORD;
  const cityLocative = city.locativeForm[locale];
  const listHref = `/${city.id}/wydarzenia`;
  // CTA hrefs depend on the user's current Date, which would differ between
  // build-time SSR and client render. Ship the fallback in static HTML, then
  // upgrade once mounted so the URL on hover / right-click is correct.
  const [urls, setUrls] = useState<CtaUrls>({
    now: listHref,
    today: listHref,
    weekend: listHref,
    sport: listHref,
    art: listHref,
    food: listHref,
    dance: listHref,
  });

  useEffect(() => {
    const now = new Date();
    // Intentional: these windows depend on the visitor's clock, so they are
    // computed after hydration — the prerendered page would otherwise carry
    // links frozen at build time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls({
      now: buildNowUrl(city.id, now),
      today: buildTodayUrl(city.id, now),
      weekend: buildWeekendUrl(city.id, now),
      sport: buildSportNowUrl(city.id, now),
      art: buildArtUrl(city.id, now),
      food: buildFoodUrl(city.id, now),
      dance: buildDanceUrl(city.id, now),
    });
  }, [city.id]);

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
          </span>
          <span className={styles.headlineLastWord} aria-hidden="true">
            <AnimatedLastWord text={headlineLastWord} />
          </span>
        </h1>
        <p className={styles.heroSub}>{t.HOME_HERO_SUB(cityLocative)}</p>
      </div>

      <section className={styles.tiles} aria-label={t.HOME_HERO_HEADLINE}>
        {tiles.map((tile) => (
          <AppLink key={tile.key} href={tile.href} className={`${styles.tile} ${tile.className}`}>
            <span className={styles.tileIcon} aria-hidden="true">
              {tile.icon}
            </span>
            <h2 className={styles.tileTitle}>{tile.title}</h2>
            <p className={styles.tileSub}>{tile.sub}</p>
            <span className={styles.tileCta}>
              <span>{tile.cta}</span>
              <ArrowForwardIcon fontSize="small" />
            </span>
          </AppLink>
        ))}
      </section>

      <section className={styles.mapSection} aria-label={t.HOME_MAP_TITLE}>
        <div className={styles.mapSectionHeader}>
          <h2 className={styles.mapSectionTitle}>{t.HOME_MAP_TITLE}</h2>
          <p className={styles.mapSectionSub}>{t.HOME_MAP_SUB}</p>
        </div>
        <AppLink
          href={`/${city.id}/wydarzenia?viewMode=map`}
          className={styles.mapSectionMap}
          aria-label={t.HOME_MAP_CTA}
        >
          <EventsMap
            events={previewEvents}
            center={city.coordinates}
            zoom={12}
            height={320}
            interactive={false}
            fitToEvents={previewEvents.length > 0}
          />
          <span className={styles.mapSectionOverlay} aria-hidden="true">
            <span className={styles.mapSectionCta}>
              {t.HOME_MAP_CTA}
              <ArrowForwardIcon fontSize="small" />
            </span>
          </span>
        </AppLink>
      </section>

      <div className={styles.browseAll}>
        <Button
          component={AppLink}
          href={listHref}
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
