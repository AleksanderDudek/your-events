import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity, isCityId } from '@/config/cities';

const m = messages[DEFAULT_LOCALE];

/** "Wydarzenia w Wrocławiu" and the matching description, for a city URL segment. */
export function cityEventsSeo(citySegment: string | undefined) {
  const cityId = citySegment && isCityId(citySegment) ? citySegment : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  return { cityId, title: m.META_EVENTS_TITLE(locative), description: m.META_DESCRIPTION(locative) };
}
