import { describe, it, expect } from 'vitest';
import {
  PROMO_DOMAIN,
  PROMO_MEDIA,
  SHARE_FORMATS,
  SHARE_TARGETS,
  SHARE_TEXT_LIMIT,
  charCount,
  eventShareUrl,
  fitCaption,
  promoCaption,
  shareTargetUrl,
  PHONE_ONLY_TARGETS,
  toHashtag,
} from './share';
import { CITIES } from '@/config/cities';
import { LOCALES, messages } from '@/i18n';

describe('charCount', () => {
  it('counts an emoji once', () => {
    expect(charCount('👉')).toBe(1);
    expect(charCount('ąę 🎉')).toBe(4);
  });
});

describe('toHashtag', () => {
  it('joins words in camel case and keeps diacritics', () => {
    expect(toHashtag('Szczecin')).toBe('#Szczecin');
    expect(toHashtag('Zielona Góra')).toBe('#ZielonaGóra');
    expect(toHashtag('Gorzów Wielkopolski')).toBe('#GorzówWielkopolski');
    expect(toHashtag('Wrocław')).toBe('#Wrocław');
  });

  it('drops what a hashtag cannot hold', () => {
    expect(toHashtag('Bielsko-Biała')).toBe('#BielskoBiała');
    expect(toHashtag("St. John's")).toBe('#StJohns');
    expect(toHashtag('  ')).toBe('');
  });
});

describe('fitCaption', () => {
  const template = (tags: string) => `x`.repeat(100) + ` ${tags}`;

  it('keeps every tag that fits', () => {
    expect(fitCaption(template, ['#a', '#b'])).toBe(`${'x'.repeat(100)} #a #b`);
  });

  it('drops tags from the end until it fits', () => {
    const tags = ['#idznamiasto', '#' + 'y'.repeat(20)];
    const text = fitCaption(template, tags, 115);
    expect(text).toBe(`${'x'.repeat(100)} #idznamiasto`);
  });

  it('ignores empty tags', () => {
    expect(fitCaption(template, ['', '#a', ''])).toBe(`${'x'.repeat(100)} #a`);
  });
});

describe('promoCaption', () => {
  // Every city the config knows, not only the live ones: a long name
  // ("Gorzów Wielkopolski") must not break the limit the day it launches.
  for (const locale of LOCALES) {
    for (const format of SHARE_FORMATS) {
      it(`fits ${SHARE_TEXT_LIMIT} characters and links the site (${locale}, ${format})`, () => {
        for (const city of CITIES) {
          const text = promoCaption(format, messages[locale], city.displayName[locale]);
          expect(charCount(text), text).toBeLessThanOrEqual(SHARE_TEXT_LIMIT);
          expect(text).toContain(PROMO_DOMAIN);
          expect(text).toContain('#idznamiasto');
        }
      });
    }
  }

  it('carries the city tag when there is room', () => {
    const text = promoCaption('post', messages.pl, 'Szczecin');
    expect(text).toBe(
      'Co dziś robimy? Wszystkie wydarzenia z miasta w jednym miejscu, bez konta 👉 idznamiasto.pl #idznamiasto #Szczecin #wydarzenia'
    );
  });

  it('works without a city', () => {
    expect(promoCaption('story', messages.en)).toBe(
      "Something's on and you don't know? Check idznamiasto.pl 🎉 #idznamiasto #events"
    );
  });
});

describe('PROMO_MEDIA', () => {
  it('has a video, an image and a poster for each format', () => {
    for (const format of SHARE_FORMATS) {
      const media = PROMO_MEDIA[format];
      expect(media.video).toMatch(/\/promo\/idznamiasto-(post|story)\.mp4$/);
      expect(media.image).toMatch(/\/promo\/idznamiasto-(post|story)\.jpg$/);
      expect(media.poster).toMatch(/\/promo\/poster-(post|story)\.jpg$/);
    }
  });
});

describe('shareTargetUrl', () => {
  const input = { text: 'Co dziś? 👉 idznamiasto.pl #a', url: 'https://idznamiasto.pl/', subject: 'Temat & co' };

  it('puts the whole caption into text-only targets', () => {
    expect(shareTargetUrl('whatsapp', input)).toBe(`https://wa.me/?text=${encodeURIComponent(input.text)}`);
    expect(shareTargetUrl('x', input)).toBe(`https://x.com/intent/post?text=${encodeURIComponent(input.text)}`);
    expect(shareTargetUrl('email', input)).toBe(
      `mailto:?subject=${encodeURIComponent('Temat & co')}&body=${encodeURIComponent(input.text)}`
    );
  });

  it('gives URL-only targets the link with UTM tags', () => {
    const fb = new URL(shareTargetUrl('facebook', input));
    const shared = new URL(fb.searchParams.get('u')!);
    expect(shared.origin).toBe('https://idznamiasto.pl');
    expect(shared.searchParams.get('utm_source')).toBe('facebook');
    expect(shared.searchParams.get('utm_medium')).toBe('social');

    const li = new URL(shareTargetUrl('linkedin', input));
    expect(new URL(li.searchParams.get('url')!).searchParams.get('utm_source')).toBe('linkedin');
  });

  it('leaves the link alone when asked', () => {
    const fb = new URL(shareTargetUrl('facebook', { ...input, utm: false }));
    expect(fb.searchParams.get('u')).toBe('https://idznamiasto.pl/');
  });

  it('builds a link for every target', () => {
    for (const target of SHARE_TARGETS) expect(shareTargetUrl(target, input)).toBeTruthy();
  });

  describe('chat apps', () => {
    const plan = {
      text: 'Mój tydzień:\n• 19:00 Koncert\n\nCały plan:\nhttps://idznamiasto.pl/szczecin/moj-tydzien/?plan=1.2',
      url: 'https://idznamiasto.pl/szczecin/moj-tydzien/?plan=1.2',
      subject: 'Plan',
      utm: false,
    };

    it('hands Messenger the link, which it turns into a card', () => {
      expect(shareTargetUrl('messenger', plan)).toBe(
        `fb-messenger://share/?link=${encodeURIComponent(plan.url)}`
      );
    });

    it('gives Telegram the link once, not in the text as well', () => {
      const tg = new URL(shareTargetUrl('telegram', plan));
      expect(tg.origin).toBe('https://t.me');
      expect(tg.searchParams.get('url')).toBe(plan.url);
      expect(tg.searchParams.get('text')).toBe('Mój tydzień:\n• 19:00 Koncert\n\nCały plan:');
    });

    it('puts the whole message into an SMS', () => {
      expect(shareTargetUrl('sms', plan)).toBe(`sms:?&body=${encodeURIComponent(plan.text)}`);
    });

    it('marks the targets that need a phone', () => {
      expect([...PHONE_ONLY_TARGETS].sort()).toEqual(['messenger', 'sms']);
    });
  });
});

describe('eventShareUrl', () => {
  it('drops the query and the hash', () => {
    expect(eventShareUrl('https://idznamiasto.pl/wroclaw/muzyka/koncert-ab12/?utm_source=x#mapa')).toBe(
      'https://idznamiasto.pl/wroclaw/muzyka/koncert-ab12/'
    );
  });
});
