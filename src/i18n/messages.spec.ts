import { describe, it, expect } from 'vitest';
import { inCityPl, messages } from './messages';

describe('inCityPl', () => {
  it.each([
    ['Wrocławiu', 'we Wrocławiu'],
    ['Włocławku', 'we Włocławku'],
    ['Szczecinie', 'w Szczecinie'],
    ['Warszawie', 'w Warszawie'],
    ['Krakowie', 'w Krakowie'],
    ['Łodzi', 'w Łodzi'],
    ['Poznaniu', 'w Poznaniu'],
    ['Wieliczce', 'w Wieliczce'],
  ])('%s → %s', (locative, expected) => {
    expect(inCityPl(locative)).toBe(expected);
  });

  it('reaches the page titles and the share text', () => {
    expect(messages.pl.META_EVENTS_TITLE('Wrocławiu')).toBe('Wydarzenia we Wrocławiu');
    expect(messages.pl.WEEK_META_TITLE('Wrocławiu')).toBe('Twój tydzień we Wrocławiu');
    expect(messages.pl.WEEK_SHARE_TEXT('Szczecinie')).toMatch(/^Mój tydzień w Szczecinie/);
  });
});
