// "Twój tydzień" as a PDF: one A4 document to send by e-mail or chat, or to
// print. Built in the browser (the site is static — there is no server to
// render it), with pdf-lib and the site's own fonts.
//
// Loaded on demand (`await import('@/lib/planPdf')`): pdf-lib and fontkit are
// heavy, and only someone exporting a plan should pay for them.
//
// Text is real text — selectable, searchable, Polish letters intact — and every
// event title links to its page, so the PDF is a working itinerary, not a
// screenshot.

import { PDFDocument, PDFFont, PDFPage, PDFString, rgb, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { withBasePath } from '@/lib/constants';

export interface PlanPdfEvent {
  /** "19:00" or the all-day label. */
  time: string;
  name: string;
  /** "Filharmonia · ok. 60 zł · Muzyka" */
  meta: string;
  /** Absolute URL of the event's page. */
  url: string;
  /** The category's colour, `#rrggbb`. */
  color?: string;
}

export interface PlanPdfDay {
  /** "Piątek, 28 lis" */
  label: string;
  events: PlanPdfEvent[];
}

export interface PlanPdfFonts {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
  display: ArrayBuffer | Uint8Array;
}

export interface PlanPdfInput {
  /** "Twój tydzień w Szczecinie" */
  title: string;
  /** "28 lis – 4 gru" */
  subtitle: string;
  /** "Tydzień: ok. 125 zł na osobę" — omitted when unknown. */
  cost?: string;
  days: PlanPdfDay[];
  /** The plan's own link — the recipient opens and copies it from there. */
  planUrl: string;
  openOnlineLabel: string;
  detailsLabel: string;
  /** "Plan z idznamiasto.pl · 23.11.2026" */
  footer: string;
  pageLabel: (page: number, total: number) => string;
  /** BCP 47, for screen readers and search: "pl-PL". */
  language: string;
  fonts: PlanPdfFonts;
}

// ── Look ─────────────────────────────────────────────────────────────────────

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const BOTTOM = 64; // above the footer
const TIME_COLUMN = 74;

export function hexColor(color: string, fallback: RGB): RGB {
  const match = color.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const n = Number.parseInt(match[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// src/styles/tokens.scss, light theme.
const INK = rgb(0x22 / 255, 0x1c / 255, 0x26 / 255);
const INK_MUTED = rgb(0x6e / 255, 0x65 / 255, 0x75 / 255);
const PRIMARY = rgb(0xf4 / 255, 0x55 / 255, 0x3b / 255);
const PRIMARY_DARK = rgb(0xd9 / 255, 0x43 / 255, 0x2f / 255);
const BORDER = rgb(0xe9 / 255, 0xe2 / 255, 0xd9 / 255);
const TINT = rgb(0xfd / 255, 0xe9 / 255, 0xe4 / 255);

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * The text a font can actually draw. Event names carry emoji and symbols
 * ("Sylwester ☆ Szczecin") the subset fonts lack; a missing glyph would draw
 * as a box. Whitespace runs become single spaces.
 */
export function drawable(text: string, supported: ReadonlySet<number>): string {
  let out = '';
  for (const char of text.replace(/\s+/g, ' ')) {
    if (char === ' ' || supported.has(char.codePointAt(0) ?? 0)) out += char;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

/** Lines no wider than `width`, broken at spaces (inside a word only if it must). */
export function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A word wider than the line on its own: cut it.
    let rest = word;
    while (measure(rest) > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > width) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

interface Typeface {
  font: PDFFont;
  supported: ReadonlySet<number>;
}

async function embed(doc: PDFDocument, bytes: ArrayBuffer | Uint8Array): Promise<Typeface> {
  // Already subset to what the PDF needs (public/fonts/pdf/README.md);
  // pdf-lib's own subsetting is known to mangle spacing on some fonts.
  const font = await doc.embedFont(bytes, { subset: false });
  return { font, supported: new Set(font.getCharacterSet()) };
}

function addLink(doc: PDFDocument, page: PDFPage, url: string, x: number, y: number, w: number, h: number) {
  const annotation = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + w, y + h],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    })
  );
  page.node.addAnnot(annotation);
}

// ── The document ─────────────────────────────────────────────────────────────

export async function buildPlanPdf(input: PlanPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await embed(doc, input.fonts.regular);
  const bold = await embed(doc, input.fonts.bold);
  const display = await embed(doc, input.fonts.display);

  doc.setTitle(drawable(input.title, regular.supported), { showInWindowTitleBar: true });
  doc.setSubject(input.subtitle);
  doc.setAuthor('Idź na miasto');
  doc.setCreator('idznamiasto.pl');
  doc.setProducer('idznamiasto.pl');
  doc.setLanguage(input.language);

  const width = A4[0] - 2 * MARGIN;
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  /** Draws wrapped text with its top at `y`; returns the height used. */
  const text = (t: Typeface, value: string, x: number, size: number, color: RGB, maxWidth: number, leading = 1.3) => {
    const lines = wrap(drawable(value, t.supported), maxWidth, (s) => t.font.widthOfTextAtSize(s, size));
    lines.forEach((line, i) => {
      page.drawText(line, { x, y: y - size - i * size * leading, size, font: t.font, color });
    });
    return lines.length * size * leading;
  };

  const lineCount = (t: Typeface, value: string, size: number, maxWidth: number) =>
    wrap(drawable(value, t.supported), maxWidth, (s) => t.font.widthOfTextAtSize(s, size)).length;

  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
    // A running head, so a loose second page still says what it belongs to.
    y -= text(regular, `${input.title} · ${input.subtitle}`, MARGIN, 8.5, INK_MUTED, width) + 18;
  };

  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) newPage();
  };

  const nameWidth = width - TIME_COLUMN;
  const eventHeight = (event: PlanPdfEvent) =>
    lineCount(bold, event.name, 11.5, nameWidth) * 15 +
    (event.meta ? lineCount(regular, event.meta, 9.5, nameWidth) * 12.35 : 0) +
    26;

  // Header: the accent bar, the brand, the title.
  page.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: PRIMARY });
  y -= text(bold, 'IDŹ NA MIASTO', MARGIN, 9, PRIMARY_DARK, width) + 10;
  y -= text(display, input.title, MARGIN, 26, INK, width, 1.15) + 6;
  y -= text(regular, input.subtitle, MARGIN, 12.5, INK_MUTED, width) + 2;
  if (input.cost) y -= text(regular, input.cost, MARGIN, 10.5, INK, width);
  y -= 16;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 1, color: BORDER });
  y -= 18;

  for (const day of input.days) {
    // A day heading is never left alone at the foot of a page.
    ensure(32 + (day.events[0] ? eventHeight(day.events[0]) : 0));
    y -= text(display, day.label, MARGIN, 14, INK, width) + 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.75, color: BORDER });
    y -= 10;

    for (const event of day.events) {
      ensure(eventHeight(event));
      const top = y;
      page.drawCircle({ x: MARGIN + 4, y: y - 7.5, size: 3.5, color: hexColor(event.color ?? '', PRIMARY) });
      text(bold, event.time, MARGIN + 14, 11, INK, TIME_COLUMN - 18);

      const nameHeight = text(bold, event.name, MARGIN + TIME_COLUMN, 11.5, INK, nameWidth);
      addLink(doc, page, event.url, MARGIN + TIME_COLUMN, top - nameHeight - 2, nameWidth, nameHeight + 2);
      y -= nameHeight + 1;
      if (event.meta) y -= text(regular, event.meta, MARGIN + TIME_COLUMN, 9.5, INK_MUTED, nameWidth);

      const details = `${drawable(input.detailsLabel, regular.supported)} →`;
      text(regular, details, MARGIN + TIME_COLUMN, 9, PRIMARY_DARK, nameWidth);
      addLink(doc, page, event.url, MARGIN + TIME_COLUMN, y - 12, regular.font.widthOfTextAtSize(details, 9), 12);
      y -= 24;
    }
    y -= 6;
  }

  // The way back: the plan online, where it can be copied and changed.
  const boxHeight = 44 + lineCount(regular, input.planUrl, 8.5, width - 32) * 11;
  ensure(boxHeight + 8);
  y -= 4;
  const boxTop = y;
  page.drawRectangle({ x: MARGIN, y: boxTop - boxHeight, width, height: boxHeight, color: TINT });
  y -= 14;
  text(bold, input.openOnlineLabel, MARGIN + 16, 11, INK, width - 32);
  y -= 20;
  text(regular, input.planUrl, MARGIN + 16, 8.5, PRIMARY_DARK, width - 32);
  addLink(doc, page, input.planUrl, MARGIN, boxTop - boxHeight, width, boxHeight);

  // Footers, now that the page count is known.
  const pages = doc.getPages();
  const footer = drawable(input.footer, regular.supported);
  pages.forEach((p, i) => {
    p.drawText(footer, { x: MARGIN, y: 32, size: 8.5, font: regular.font, color: INK_MUTED });
    const label = input.pageLabel(i + 1, pages.length);
    const labelWidth = regular.font.widthOfTextAtSize(label, 8.5);
    p.drawText(label, { x: A4[0] - MARGIN - labelWidth, y: 32, size: 8.5, font: regular.font, color: INK_MUTED });
  });

  return doc.save();
}

// ── Fonts, in the browser ────────────────────────────────────────────────────

const FONT_FILES = {
  regular: '/fonts/pdf/Figtree-Regular.ttf',
  bold: '/fonts/pdf/Figtree-Bold.ttf',
  display: '/fonts/pdf/BricolageGrotesque-ExtraBold.ttf',
} as const;

export async function fetchPlanPdfFonts(): Promise<PlanPdfFonts> {
  const load = async (path: string) => {
    const response = await fetch(withBasePath(path));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.arrayBuffer();
  };
  const [regular, bold, display] = await Promise.all([
    load(FONT_FILES.regular),
    load(FONT_FILES.bold),
    load(FONT_FILES.display),
  ]);
  return { regular, bold, display };
}
