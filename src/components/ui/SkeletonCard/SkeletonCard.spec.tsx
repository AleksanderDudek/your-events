import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import SkeletonCard from './SkeletonCard';

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<SkeletonCard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
