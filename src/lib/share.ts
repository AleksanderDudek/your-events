// Pure helpers behind the two share features: recommending the site itself
// ("Poleć Idź na miasto" — a post or a story with the promo video) and sharing
// one event. The browser side (Web Share API, clipboard, fetching the video)
// lives in components/service/useShare*, mirroring the lib/consent split, so
// the rules with teeth — caption length, hashtags, link building — are tested
// without a DOM.

import { withBasePath } from '@/lib/constants';
import type { Messages } from '@/i18n/messages';

// The site being recommended. Deliberately the production domain and not
// SITE_URL: a visitor on the dev build who recommends the app should send
// friends to the real one.
export const PROMO_DOMAIN = 'idznamiasto.pl';
export const PROMO_URL = `https://${PROMO_DOMAIN}/`;

// The owner's target for a caption. Counted in code points (what a person sees
// as characters), not UTF-16 units, so an emoji counts once.
export const SHARE_TEXT_LIMIT = 130;

export type ShareFormat = 'post' | 'story';
export const SHARE_FORMATS: readonly ShareFormat[] = ['post', 'story'];

export interface PromoMedia {
  /** The promo video, cut for this format. */
  video: string;
  /** Still shared instead when the video cannot be (too slow, unsupported). */
  image: string;
  /** First frame shown in the preview before the video plays. */
  poster: string;
  videoName: string;
  imageName: string;
  /** CSS aspect-ratio of both. */
  aspect: string;
}

// public/promo/ — the video files are re-encodes of
// ~/Projects/idznamiasto-promo/out/idznamiasto-promo.mp4 (9:16, 39.5 s); the
// post cut is the same film on a blurred 4:5 canvas. The JPGs come from
// scripts/render-promo-images.mjs. Paths go through withBasePath because they
// are fetched and put in <video src>, which Next does not prefix.
export const PROMO_MEDIA: Record<ShareFormat, PromoMedia> = {
  post: {
    video: withBasePath('/promo/idznamiasto-post.mp4'),
    image: withBasePath('/promo/idznamiasto-post.jpg'),
    poster: withBasePath('/promo/poster-post.jpg'),
    videoName: 'idznamiasto-post.mp4',
    imageName: 'idznamiasto-post.jpg',
    aspect: '4 / 5',
  },
  story: {
    video: withBasePath('/promo/idznamiasto-story.mp4'),
    image: withBasePath('/promo/idznamiasto-story.jpg'),
    poster: withBasePath('/promo/poster-story.jpg'),
    videoName: 'idznamiasto-story.mp4',
    imageName: 'idznamiasto-story.jpg',
    aspect: '9 / 16',
  },
};

export function charCount(text: string): number {
  return [...text].length;
}

// "Zielona Góra" -> "#ZielonaGóra". Diacritics stay: every major platform
// accepts them in hashtags, and "#Wroclaw" is a different tag from "#Wrocław".
export function toHashtag(name: string): string {
  const body = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase('pl') + word.slice(1))
    .join('')
    .replace(/[^\p{L}\p{N}_]/gu, '');
  return body ? `#${body}` : '';
}

/**
 * Builds a caption from a template that takes the hashtag string, then drops
 * hashtags from the end until it fits the limit. The brand tag comes first in
 * the list so it is the last to go.
 */
export function fitCaption(
  template: (hashtags: string) => string,
  hashtags: readonly string[],
  limit: number = SHARE_TEXT_LIMIT
): string {
  const tags = hashtags.filter(Boolean);
  for (let n = tags.length; n >= 0; n--) {
    const text = template(tags.slice(0, n).join(' ')).trim();
    if (charCount(text) <= limit) return text;
  }
  return template('').trim();
}

// Where a recommendation came from, for the utm_source of links that leave a
// URL field separate from the text.
function withUtm(url: string, source: string): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', 'polec');
  return u.toString();
}

export type ShareTarget = 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'email';
export const SHARE_TARGETS: readonly ShareTarget[] = ['whatsapp', 'facebook', 'x', 'linkedin', 'email'];

/**
 * Web intents for when the native share sheet is missing (most desktops) or
 * the visitor prefers a specific app. `text` already contains the link;
 * `url` is what platforms that take only a URL (Facebook, LinkedIn — they
 * build the card from og: tags and ignore prefilled text) receive.
 */
export function shareTargetUrl(
  target: ShareTarget,
  { text, url, subject, utm = true }: { text: string; url: string; subject: string; utm?: boolean }
): string {
  const link = utm ? withUtm(url, target) : url;
  const enc = encodeURIComponent;
  switch (target) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(text)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`;
    case 'x':
      return `https://x.com/intent/post?text=${enc(text)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}`;
    case 'email':
      return `mailto:?subject=${enc(subject)}&body=${enc(text)}`;
  }
}

/** The address of an event page as the visitor sees it, minus query and hash. */
export function eventShareUrl(href: string): string {
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

type CaptionMessages = Pick<Messages, 'SHARE_POST_TEXT' | 'SHARE_STORY_TEXT' | 'SHARE_HASHTAG_GENERIC'>;

/**
 * The ready-to-paste caption for one format: benefit, link, then
 * #idznamiasto, the city's tag and a generic one — fitted to SHARE_TEXT_LIMIT.
 */
export function promoCaption(format: ShareFormat, t: CaptionMessages, cityName?: string): string {
  const template = format === 'post' ? t.SHARE_POST_TEXT : t.SHARE_STORY_TEXT;
  return fitCaption(template, ['#idznamiasto', cityName ? toHashtag(cityName) : '', t.SHARE_HASHTAG_GENERIC]);
}
