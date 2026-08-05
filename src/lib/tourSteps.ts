// The spotlight tour's step list. Pure data: each step names a DOM anchor by
// `data-tour` attribute and where its tooltip should sit. Copy lives in
// i18n/messages under ONBOARDING_STEPS, keyed by the same ids.
//
// Anchoring by attribute rather than by ref keeps every touched component free
// of tour logic — the components gain one attribute and nothing else.

export type TourStepId = 'search' | 'filters' | 'view' | 'sort' | 'presets';

export interface TourStep {
  id: TourStepId;
  /** Queried against the document at tour start. */
  selector: string;
  /** Preferred tooltip side; MUI's Popper flips it when it would overflow. */
  placement: 'bottom' | 'top' | 'left' | 'right';
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'search', selector: '[data-tour="search"]', placement: 'bottom' },
  { id: 'filters', selector: '[data-tour="filters"]', placement: 'right' },
  { id: 'view', selector: '[data-tour="view"]', placement: 'bottom' },
  { id: 'sort', selector: '[data-tour="sort"]', placement: 'bottom' },
  // Desktop-only: on a phone the navigation is inside a closed drawer, so this
  // anchor is absent and the step drops out by the rule below.
  { id: 'presets', selector: '[data-tour="presets"]', placement: 'bottom' },
];

/**
 * The steps whose anchors are actually on the page, in order.
 *
 * This is what lets one step list serve both layouts. On desktop the filter
 * panel is a sidebar and the presets link is in the header; on a phone the
 * panel is a Fab and the link is in a closed drawer. Rather than branching on a
 * breakpoint — which would then have to stay in step with the panel's own
 * `useMediaQuery` — the tour just asks what exists.
 */
export function visibleSteps(root: Pick<Document, 'querySelector'>): TourStep[] {
  return TOUR_STEPS.filter((step) => root.querySelector(step.selector) !== null);
}
