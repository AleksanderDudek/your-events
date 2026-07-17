import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CategoryIcon from './CategoryIcon';

describe('CategoryIcon', () => {
  it('renders an svg for a known category', () => {
    const { container } = render(<CategoryIcon category="Muzyka" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to the Inne glyph for an unknown category', () => {
    const { container } = render(<CategoryIcon category="Nonexistent" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is aria-hidden (decorative)', () => {
    const { container } = render(<CategoryIcon category="Taniec" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
