import { EventCategory } from '@/types/event.types';

// ─── Fitness (zdrofit, justgym) ───────────────────────────────────────────────

const FITNESS_NAME_MAP: [RegExp, EventCategory][] = [
  [/pilates/i, 'fitness-pilates'],
  [/joga|yoga|vital flow|zdrowy krÄgosÅup|relaks i medytacj/i, 'fitness-yoga'],
  [/rowery|cycling/i, 'fitness-cycling'],
  [/zumba|salsation/i, 'fitness-zumba'],
  [/stretching/i, 'fitness-stretching'],
  [/tabata|interwaÅ|hiit/i, 'fitness-tabata'],
  [/brzuch|abs|pÅaski|poÅladki|abt|brazylijskie/i, 'fitness-abs'],
  [/shape|tbc/i, 'fitness-shape'],
];

export function inferFitnessCategory(name: string): EventCategory[] {
  for (const [pattern, category] of FITNESS_NAME_MAP) {
    if (pattern.test(name)) return [category];
  }
  return ['fitness'];
}

// ─── Dance (abballu, kimama) ──────────────────────────────────────────────────

const DANCE_NAME_MAP: [RegExp, EventCategory][] = [
  [/bachata/i, 'dance-bachata'],
  [/salsa|rueda/i, 'dance-salsa'],
  [/kizomba|urbankiz|tarraxo/i, 'dance-kizomba'],
  [/high heels|sexy dance|latino ladies/i, 'dance-sensual'],
  [/street dance|hip.?hop|k.?pop/i, 'dance-hip-hop'],
  [/klasyczny|ballet|pointy/i, 'dance-ballet'],
  [/lyrical|contemporary|wspÃ³Åczesny/i, 'dance-contemporary'],
  [/zouk|tango|wcs|west coast/i, 'dance'],
];

export function inferDanceCategory(name: string): EventCategory[] {
  for (const [pattern, category] of DANCE_NAME_MAP) {
    if (pattern.test(name)) return [category];
  }
  return ['dance'];
}

// ─── Echoszczecina: "Kategoria:X | Y" ────────────────────────────────────────

function mapEchoszczecinaCategory(raw: string): EventCategory[] {
  const lower = raw.toLowerCase();
  if (lower.includes('jazz')) return ['concert-jazz'];
  if (lower.includes('klasyczn')) return ['concert-classical'];
  if (lower.includes('rock') || lower.includes('metal') || lower.includes('punk')) return ['concert-rock'];
  if (lower.includes('alternatyw') || lower.includes('pop')) return ['concert'];
  if (lower.includes('muzyka') || lower.includes('muzyki') || lower.includes('muzyk')) return ['concert'];
  if (lower.includes('spektakl') || lower.includes('scena')) return ['theatre'];
  if (lower.includes('wystawa') || lower.includes('wernisaÅ')) return ['exhibition'];
  if (lower.includes('spotkanie') || lower.includes('konferencj') || lower.includes('wykÅad')) return ['social-event'];
  if (lower.includes('warsztaty') || lower.includes('warsztat')) return ['workshop'];
  if (lower.includes('film') || lower.includes('kino')) return ['social-event'];
  return [];
}

// ─── Wszczecinie: comma-separated Polish tags ─────────────────────────────────

const WSZCZECINIE_MAP: [RegExp, EventCategory][] = [
  [/spektakle i opery/i, 'theatre'],
  [/stand.?up|kabaret/i, 'standup'],
  [/wystaw|wernisaÅ/i, 'exhibition'],
  [/dla dzieci/i, 'kids-event'],
  [/taniec/i, 'dance'],
  [/sport/i, 'sports-event'],
  [/warsztaty|warsztat/i, 'workshop'],
  [/kulinarn/i, 'culinary'],
  [/koncert/i, 'concert'],
  [/festiwal/i, 'concert'],
  [/film|kino/i, 'social-event'],
  [/spotkania|wykÅad|konferencj|ksiÄÅ¼ki/i, 'social-event'],
  [/jarmark|festyn|pchli targ/i, 'social-event'],
  [/inne/i, 'social-event'],
];

function mapWszczecinieCatgory(raw: string): EventCategory[] {
  const results = new Set<EventCategory>();
  for (const [pattern, cat] of WSZCZECINIE_MAP) {
    if (pattern.test(raw)) results.add(cat);
  }
  return [...results];
}

// ─── Filharmonia ──────────────────────────────────────────────────────────────

function mapFilharmoniaCategory(raw: string): EventCategory[] {
  const lower = raw.toLowerCase();
  if (lower.includes('jazz')) return ['concert-jazz'];
  if (lower.includes('muzyk')) return ['concert-classical'];
  if (lower.includes('recital')) return ['concert-classical'];
  if (lower.includes('kameralne') || lower.includes('symfoniczne')) return ['concert-classical'];
  if (lower.includes('edu') || lower.includes('dziecko') || lower.includes('malucha') || lower.includes('mlodego melomana')) return ['kids-event'];
  if (lower.includes('zwiedzanie')) return ['exhibition'];
  if (lower.includes('wystawy') || lower.includes('galeria')) return ['exhibition'];
  if (lower.includes('warsztaty')) return ['workshop'];
  if (lower.includes('Åwiata') || lower.includes('world')) return ['concert'];
  if (lower.includes('filharmonia light')) return ['concert-classical'];
  return ['concert-classical'];
}

// ─── Ticketmaster ─────────────────────────────────────────────────────────────

function mapTicketmasterCategory(raw: string): EventCategory[] {
  const lower = raw.toLowerCase();
  if (lower.includes('jazz')) return ['concert-jazz'];
  if (lower.includes('klasyczna') || lower.includes('classical')) return ['concert-classical'];
  if (lower.includes('rock') || lower.includes('punk') || lower.includes('metal')) return ['concert-rock'];
  if (lower.includes('hip.?hop') || lower.includes('rap')) return ['concert-hip-hop'];
  if (lower.includes('muzyk') || lower.includes('music') || lower.includes('world')) return ['concert'];
  if (lower.includes('stand.?up')) return ['standup'];
  if (lower.includes('sport')) return ['sports-event'];
  return ['concert'];
}

// ─── Eneaarena ────────────────────────────────────────────────────────────────

function mapEneaarenaCategory(raw: string): EventCategory[] {
  const lower = raw.toLowerCase();
  if (lower.includes('mecz') || lower.includes('sport')) return ['sports-event'];
  if (lower.includes('targi')) return ['social-event'];
  if (lower.includes('stand up') || lower.includes('stand-up')) return ['standup'];
  if (lower.includes('koncert') || lower.includes('muzyk')) return ['concert'];
  return ['social-event'];
}

// ─── Facebook / wiadomosci (derive from name) ─────────────────────────────────

const FACEBOOK_NAME_MAP: [RegExp, EventCategory][] = [
  [/stand.?up|kabaret/i, 'standup'],
  [/spektakl|premiera|teatr/i, 'theatre'],
  [/wystawa|wernisaÅ/i, 'exhibition'],
  [/koncert|muzyka|jazz|rock|metal/i, 'concert'],
  [/warsztaty|warsztat/i, 'workshop'],
  [/dla dzieci|bajka|przedszkole|malucha/i, 'kids-event'],
  [/mecz|turniej|bieg|maratoÅ/i, 'sports-event'],
  [/taniec|tango|bachata|salsa|kizomba|zumba/i, 'dance'],
  [/pilates|yoga|joga|fitness|trening/i, 'fitness'],
  [/film|kino|seans/i, 'social-event'],
  [/spotkanie|debata|konferencja|wykÅad/i, 'social-event'],
];

function inferFromName(name: string): EventCategory[] {
  for (const [pattern, category] of FACEBOOK_NAME_MAP) {
    if (pattern.test(name)) return [category];
  }
  return [];
}

// ─── Slowianin / biblioteka_mbp ──────────────────────────────────────────────

function mapSłowianinCategory(raw: string, name: string): EventCategory[] {
  if (!raw || raw.toLowerCase() === 'kultura') {
    return inferFromName(name);
  }
  return inferFromName(name);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function mapCategories(
  source: string,
  rawCategory: string,
  name: string
): EventCategory[] {
  const s = source?.toLowerCase() ?? '';

  if (s.startsWith('zdrofit') || s === 'justgym') return inferFitnessCategory(name);
  if (s === 'abballu' || s === 'kimama') return inferDanceCategory(name);
  if (s === 'kulinarneatelier' || s === 'studiobataty') return ['culinary-workshop'];
  if (s === 'filharmonia') return mapFilharmoniaCategory(rawCategory);
  if (s === 'echoszczecina') return mapEchoszczecinaCategory(rawCategory);
  if (s === 'wszczecinie' || s === 'wiadomosci') return mapWszczecinieCatgory(rawCategory);
  if (s === 'ticketmaster') return mapTicketmasterCategory(rawCategory);
  if (s === 'eneaarena') return mapEneaarenaCategory(rawCategory);
  if (s === 'multikino' || s === 'pionier') return ['social-event'];
  if (s === 'slowianin' || s === 'biblioteka_mbp') return mapSłowianinCategory(rawCategory, name);
  if (s === 'facebook' || s === 'facebook_group') return inferFromName(name);
  if (s === 'eventis') return ['workshop'];

  // Fallback: try echoszczecina/wszczecinie patterns, then name
  const fromCategory = mapEchoszczecinaCategory(rawCategory).length
    ? mapEchoszczecinaCategory(rawCategory)
    : mapWszczecinieCatgory(rawCategory);
  return fromCategory.length ? fromCategory : inferFromName(name);
}
