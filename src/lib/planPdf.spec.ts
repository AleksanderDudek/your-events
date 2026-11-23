// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { buildPlanPdf, drawable, wrap, type PlanPdfInput } from './planPdf';

const fontDir = join(process.cwd(), 'public', 'fonts', 'pdf');
const fonts = {
  regular: readFileSync(join(fontDir, 'Figtree-Regular.ttf')),
  bold: readFileSync(join(fontDir, 'Figtree-Bold.ttf')),
  display: readFileSync(join(fontDir, 'BricolageGrotesque-ExtraBold.ttf')),
};

function input(overrides: Partial<PlanPdfInput> = {}): PlanPdfInput {
  return {
    title: 'Twój tydzień w Szczecinie',
    subtitle: '23 lis – 29 lis',
    cost: 'Tydzień: ok. 125 zł na osobę',
    days: [
      {
        label: 'Poniedziałek, 23 lis',
        events: [
          {
            time: '19:00',
            name: 'Koncert jazzowy — Żółć, gęślą jaźń ☆ 🎷',
            meta: 'Filharmonia · 60 zł · Muzyka',
            url: 'https://idznamiasto.pl/szczecin/muzyka/koncert-ab12/',
            color: '#7c4dff',
          },
        ],
      },
    ],
    planUrl: 'https://idznamiasto.pl/szczecin/moj-tydzien/?plan=1',
    openOnlineLabel: 'Otwórz plan online i skopiuj go do siebie',
    detailsLabel: 'szczegóły',
    footer: 'Plan z idznamiasto.pl · 23.11.2026',
    pageLabel: (n, total) => `${n}/${total}`,
    language: 'pl-PL',
    fonts,
    ...overrides,
  };
}

function linkTargets(doc: PDFDocument): string[] {
  return doc.getPages().flatMap((page) => {
    const annots = page.node.lookup(PDFName.of('Annots'), PDFArray);
    if (!annots) return [];
    return annots.asArray().map((ref) => {
      const action = (doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A')) as PDFDict);
      return (action.lookup(PDFName.of('URI')) as PDFString).decodeText();
    });
  });
}

describe('buildPlanPdf', () => {
  it('makes a valid one-page PDF with the plan’s title and language', async () => {
    const bytes = await buildPlanPdf(input());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Twój tydzień w Szczecinie');
    expect(doc.getAuthor()).toBe('Idź na miasto');
  });

  it('links every event to its page, and the plan to itself', async () => {
    const doc = await PDFDocument.load(await buildPlanPdf(input()));
    const targets = linkTargets(doc);
    // The title and "szczegóły" both lead to the event.
    expect(targets.filter((u) => u.endsWith('/koncert-ab12/'))).toHaveLength(2);
    expect(targets).toContain('https://idznamiasto.pl/szczecin/moj-tydzien/?plan=1');
  });

  it('flows a long plan onto more pages', async () => {
    const days = Array.from({ length: 7 }, (_, d) => ({
      label: `Dzień ${d + 1}`,
      events: Array.from({ length: 3 }, (_, i) => ({
        time: `1${i}:00`,
        name: `Wydarzenie z bardzo długim tytułem, który się zawinie na dwie linie, numer ${d}-${i}`,
        meta: 'Miejsce, ul. Długa 1 · 40 zł · Teatr i Widowiska',
        url: `https://idznamiasto.pl/e/${d}-${i}/`,
      })),
    }));
    const doc = await PDFDocument.load(await buildPlanPdf(input({ days })));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(linkTargets(doc).filter((u) => u.includes('/e/'))).toHaveLength(42);
  });

  it('works without a cost line', async () => {
    const doc = await PDFDocument.load(await buildPlanPdf(input({ cost: undefined })));
    expect(doc.getPageCount()).toBe(1);
  });
});

describe('drawable', () => {
  it('drops what the font cannot draw and tidies the spaces', () => {
    const supported = new Set([...'Sylwester w Szczecinie'].map((c) => c.codePointAt(0)!));
    expect(drawable('Sylwester ☆ w   Szczecinie 🎉\n', supported)).toBe('Sylwester w Szczecinie');
  });
});

describe('wrap', () => {
  const measure = (s: string) => s.length;

  it('breaks at spaces', () => {
    expect(wrap('aaa bbb ccc', 7, measure)).toEqual(['aaa bbb', 'ccc']);
  });

  it('cuts a word longer than the line', () => {
    expect(wrap('abcdefghij', 4, measure)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('returns nothing for nothing', () => {
    expect(wrap('', 10, measure)).toEqual([]);
  });
});
