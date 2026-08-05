'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useOnboarding } from '@/components/service/useOnboarding';
import { useConsent } from '@/components/service/useConsent';
import { useCity } from '@/config/CityProvider';
import { isCityId } from '@/config/cities';
import { useTranslation } from '@/i18n';
import { countActiveFilters, parseFiltersFromParams } from '@/lib/filterUtils';
import { isOnboardingRoute, isTourRoute, tourPath } from '@/lib/onboarding';
import { visibleSteps, type TourStep } from '@/lib/tourSteps';
import WelcomeSheet from './WelcomeSheet';
import StoryRunner from './StoryRunner';

// The controls the story points at mount with the page, but a client-side
// navigation from the city home lands here a frame or two before they exist.
// Rather than concluding "no anchors, nothing to show" on the first look, the
// start is retried for about a second.
const ANCHOR_RETRY_LIMIT = 10;
const ANCHOR_RETRY_MS = 100;

/**
 * Decides what — if anything — a visitor is shown on arrival.
 *
 * Mounted once in AppLayout, so it is on every page of the site: deliberately
 * cheap. Everything the story needs to actually run (categories, presets, the
 * filter router) lives in StoryRunner, which only mounts once someone asks for
 * the tour.
 */
export default function Onboarding() {
  const {
    isReady,
    hasSeen,
    isTourPending,
    markSeen,
    requestTour,
    clearTourRequest,
  } = useOnboarding();
  // The cookie banner outranks onboarding: it is a legal choice, it is already
  // on screen, and two stacked overlays on a first visit is the failure this
  // design most wants to avoid.
  const { isOpen: isConsentOpen } = useConsent();
  const pathname = usePathname();
  const router = useRouter();
  const { city } = useCity();
  const { locale } = useTranslation();

  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const isTouring = steps !== null;

  // Someone who followed a shared filter link came for those results. The story
  // would overwrite them with dance classes on Thursdays, so it stays quiet.
  //
  // Read once, from `window.location` rather than through `useSearchParams`:
  // this component sits in the root layout, and putting that hook there would
  // make every prerendered page in the export drag a Suspense requirement
  // behind it. A lazy initialiser is also the honest shape of the question —
  // "what did they arrive with", not "what is on screen now", which the story
  // is about to change from under itself.
  const [hasIncomingFilters] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return countActiveFilters(parseFiltersFromParams(params)) > 0;
  });

  useEffect(() => {
    if (!isReady || !isTourPending || isTouring) return;
    if (!isTourRoute(pathname, isCityId)) return;

    let attempts = 0;
    let timer = 0;

    const tryStart = () => {
      const found = visibleSteps(document);
      if (found.length > 0) {
        clearTourRequest();
        setSteps(found);
        return;
      }
      attempts += 1;
      if (attempts >= ANCHOR_RETRY_LIMIT) {
        // Nothing to point at even after waiting — mark it seen rather than
        // retrying on every page load forever.
        clearTourRequest();
        markSeen();
        return;
      }
      timer = window.setTimeout(tryStart, ANCHOR_RETRY_MS);
    };

    timer = window.setTimeout(tryStart, 0);
    return () => window.clearTimeout(timer);
  }, [isReady, isTourPending, isTouring, pathname, clearTourRequest, markSeen]);

  const handleStart = useCallback(() => {
    requestTour();
    // The city home has none of the controls, so the story runs on the list.
    // The request survives the navigation (it is module state, not component
    // state) and the effect above picks it up on arrival.
    if (!isTourRoute(pathname, isCityId)) {
      router.push(tourPath(city.id) as Route);
    }
  }, [requestTour, pathname, router, city.id]);

  const handleStoryFinish = useCallback(() => {
    setSteps(null);
    markSeen();
  }, [markSeen]);

  if (!isReady) return null;

  if (isTouring) {
    return <StoryRunner steps={steps} onFinish={handleStoryFinish} />;
  }

  const showSheet =
    !hasSeen &&
    !isConsentOpen &&
    !isTourPending &&
    !hasIncomingFilters &&
    isOnboardingRoute(pathname, isCityId);
  if (!showSheet) return null;

  return (
    <WelcomeSheet
      cityLocative={city.locativeForm[locale]}
      onSkip={markSeen}
      onStart={handleStart}
    />
  );
}
