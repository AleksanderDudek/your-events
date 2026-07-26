'use client';

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ForumIcon from '@mui/icons-material/Forum';
import RateReviewIcon from '@mui/icons-material/RateReview';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from '@/i18n';
import { AVAILABLE_CITIES } from '@/config/cities';
import { DISCORD_INVITE_URL, FEEDBACK_FORM_URL } from '@/config/community';
import type { Locale } from '@/i18n';
import styles from './GrowWithUsView.module.scss';

// "Wrocław i Szczecin" / "Wrocław and Szczecin". Intl.ListFormat is deterministic
// for a given locale + input, so the server-rendered string and the hydrated one
// agree; the join fallback covers runtimes without it (older Safari).
function formatCityList(names: readonly string[], locale: Locale): string {
  if (typeof Intl !== 'undefined' && 'ListFormat' in Intl) {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  }
  return names.join(', ');
}

export default function GrowWithUsView() {
  const { t, locale } = useTranslation();
  const cityList = formatCityList(
    AVAILABLE_CITIES.map((c) => c.displayName[locale]),
    locale
  );

  const channels = [
    {
      key: 'discord',
      href: DISCORD_INVITE_URL,
      icon: <ForumIcon />,
      title: t.GROW_DISCORD_TITLE,
      body: t.GROW_DISCORD_BODY,
      cta: t.GROW_DISCORD_CTA,
      className: styles.channelDiscord,
      variant: 'contained' as const,
    },
    {
      key: 'form',
      href: FEEDBACK_FORM_URL,
      icon: <RateReviewIcon />,
      title: t.GROW_FORM_TITLE,
      body: t.GROW_FORM_BODY,
      cta: t.GROW_FORM_CTA,
      className: styles.channelForm,
      variant: 'outlined' as const,
    },
  ];

  return (
    <Box className={styles.container}>
      <span className={styles.blob} aria-hidden="true" />
      <span className={styles.blobTwo} aria-hidden="true" />

      <header className={styles.hero}>
        <p className={styles.prompt}>{t.GROW_PROMPT}</p>
        <h1 className={styles.headline}>{t.GROW_HEADLINE}</h1>
        <p className={styles.lead}>{t.GROW_LEAD}</p>
      </header>

      <section className={styles.story}>
        <p className={styles.paragraph}>{t.GROW_STORY_1}</p>
        <p className={styles.paragraph}>{t.GROW_STORY_2}</p>
        <p className={styles.paragraph}>{t.GROW_STORY_3}</p>
        <p className={styles.paragraph}>{t.GROW_STORY_4(cityList)}</p>
        <p className={styles.punch}>{t.GROW_STORY_PUNCH}</p>
      </section>

      <section className={styles.channels} aria-labelledby="grow-channels-title">
        <h2 className={styles.channelsTitle} id="grow-channels-title">
          {t.GROW_CHANNELS_TITLE}
        </h2>
        <p className={styles.channelsSub}>{t.GROW_CHANNELS_SUB}</p>

        <div className={styles.channelGrid}>
          {channels.map((channel) => (
            <article key={channel.key} className={`${styles.channel} ${channel.className}`}>
              <span className={styles.channelIcon} aria-hidden="true">
                {channel.icon}
              </span>
              <h3 className={styles.channelTitle}>{channel.title}</h3>
              <p className={styles.channelBody}>{channel.body}</p>
              <Button
                className={styles.channelCta}
                component="a"
                href={channel.href}
                target="_blank"
                // noopener strips window.opener from the new tab; noreferrer
                // keeps our URL out of the destination's referrer log.
                rel="noopener noreferrer"
                variant={channel.variant}
                size="large"
                endIcon={<OpenInNewIcon />}
              >
                {channel.cta}
              </Button>
              <p className={styles.channelHint}>{t.GROW_EXTERNAL_HINT}</p>
            </article>
          ))}
        </div>
      </section>
    </Box>
  );
}
