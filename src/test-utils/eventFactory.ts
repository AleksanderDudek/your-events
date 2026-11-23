import type { Event } from '@/types/event.types';

/**
 * Test events, for specs: by default a 40 zł 19:00 concert at "Klub {id}" in
 * Szczecin on `date`. Ids count up from 1 per factory, so each spec file gets
 * its own predictable sequence. Override whatever the test is about.
 */
export function eventFactory(date: string): (overrides?: Partial<Event>) => Event {
  let nextId = 1;
  return (overrides = {}) => {
    const id = String(nextId++);
    return {
      id,
      eventKey: `key-${id}`,
      name: `Koncert ${id}`,
      description: '',
      categoryMain: 'Muzyka',
      categorySub: 'Koncert',
      date,
      startTime: '19:00',
      endTime: '',
      durationMin: null,
      location: { name: `Klub ${id}`, city: 'Szczecin', lat: null, lng: null },
      price: { amount: 40, currency: 'PLN', label: '40 zł', showLabel: false },
      url: '',
      imageUrl: '',
      sources: ['test'],
      updatedAt: null,
      ...overrides,
    };
  };
}
