import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import PriceLabel from './PriceLabel';

describe('PriceLabel', () => {
  it('renders without crashing', () => {
    render(<PriceLabel amount={35} currency="PLN" />);
    expect(screen.getByText('35 PLN')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<PriceLabel amount={35} currency="PLN" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows Bezpłatne for free events', () => {
    render(<PriceLabel amount={0} currency="PLN" />);
    expect(screen.getByText('Bezpłatne')).toBeInTheDocument();
  });

  it('shows Cena w opisie for null price', () => {
    render(<PriceLabel amount={null} currency="PLN" />);
    expect(screen.getByText('Cena w opisie')).toBeInTheDocument();
  });

  it('shows the label verbatim when showLabel is set (membership pricing)', () => {
    render(<PriceLabel amount={189} currency="PLN" label="Karnet od 189 zł" showLabel />);
    expect(screen.getByText('Karnet od 189 zł')).toBeInTheDocument();
    expect(screen.queryByText('189 PLN')).not.toBeInTheDocument();
  });

  it('ignores showLabel when label is empty', () => {
    render(<PriceLabel amount={50} currency="PLN" label="" showLabel />);
    expect(screen.getByText('50 PLN')).toBeInTheDocument();
  });
});
