import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

interface RouterRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** The URL the component renders at, query string included. */
  route?: string;
  /** Extra providers, inside the router. */
  wrapper?: (props: { children: ReactNode }) => ReactElement;
}

/**
 * render() inside a MemoryRouter. Anything that renders an AppLink or reads the
 * location needs a router above it, exactly as it has one in the app.
 */
export function renderWithRouter(ui: ReactElement, { route = '/', wrapper: Inner, ...options }: RouterRenderOptions = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{Inner ? <Inner>{children}</Inner> : children}</MemoryRouter>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
