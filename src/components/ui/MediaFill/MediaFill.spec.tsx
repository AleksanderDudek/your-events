import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MediaFill, { pickFit } from './MediaFill';

// The card band; the detail hero is 21/9 until max-height clamps it.
const CARD_SLOT = 16 / 9;

describe('pickFit', () => {
  it('fills the slot when the crop is small — the generated 800×500 covers', () => {
    // 1.60 in a 16/9 slot loses 10% off the sides: gradient margin, not text.
    expect(pickFit(800 / 500, CARD_SLOT)).toBe('cover');
  });

  it('keeps every pixel of art that is far from the slot ratio', () => {
    expect(pickFit(690 / 1024, CARD_SLOT)).toBe('contain'); // portrait flyer, 0.67
    expect(pickFit(1, CARD_SLOT)).toBe('contain'); // square source logo
    expect(pickFit(2.7, CARD_SLOT)).toBe('contain'); // banner
  });

  it('draws the line at a quarter of the image', () => {
    // 1.34 crops exactly 25% — the widest crop still worth filling the slot for.
    expect(pickFit(CARD_SLOT * 0.75, CARD_SLOT)).toBe('cover');
    expect(pickFit(CARD_SLOT * 0.74, CARD_SLOT)).toBe('contain');
  });

  it('falls back to contain on a ratio it cannot trust', () => {
    // naturalWidth is 0 until an image decodes, and a detached slot measures 0.
    expect(pickFit(0, CARD_SLOT)).toBe('contain');
    expect(pickFit(1.6, 0)).toBe('contain');
    expect(pickFit(Number.NaN, CARD_SLOT)).toBe('contain');
  });
});

describe('MediaFill', () => {
  it('renders the blurred backdrop plus the image itself before anything loads', () => {
    // `contain` is the server-rendered default, so the first paint can never
    // hide part of a poster.
    const { container } = render(
      <MediaFill src="/fallbacks/taniec-1.webp" alt="Warsztat tańca" sizes="100vw" />
    );
    expect(screen.getByAltText('Warsztat tańca')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('img[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('marks the image decorative when the caller passes no alt text', () => {
    render(<MediaFill src="/fallbacks/taniec-1.webp" alt="" sizes="100vw" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
