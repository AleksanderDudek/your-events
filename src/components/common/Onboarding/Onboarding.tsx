'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useOnboarding } from '@/components/service/useOnboarding';
import { useConsent } from '@/components/service/useConsent';
import { useCity } from '@/config/CityProvider';
import { isCityId } from '@/config/cities';
import { useTranslation } from '@/i18n';
import { isOnboardingRoute, isTourRoute, tourPath } from '@/lib/onboarding';
import { visibleSteps, type TourStep } from '@/lib/tourSteps';
import WelcomeSheet from './WelcomeSheet';
import TourOverlay from './TourOverlay';

// The controls the tour points at mount with the page, but a client-side
// navigation from the city home lands here a frame or two before they exist.
// Rather than concluding "no anchors, nothing to show" on the first look, the
// start is retried for about a second.
const ANCHOR_RETRY_LIMIT = 10;
const ANCHOR_RETRY_MS = 100;

/**
 * Decides what — if anything — a visitor is shown on arrival.
 *
 * Mounted once in AppLayout and returns null on every page where onboarding
 * has no business appearing, which is most of them.
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

  // Resolving the anchors is a DOM read, so it cannot happen during render, and
  // the work is deferred to a timer rather than run in the effect body: the
  // first tick after a client-side navigation is exactly when the controls may
  // not be mounted yet, and setting state straight from an effect body would
  // cascade a render anyway.
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
    // The city home has none of the controls, so the tour happens on the list.
    // The request survives the navigation (it is module state, not component
    // state) and the effect above picks it up on arrival.
    if (!isTourRoute(pathname, isCityId)) {
      router.push(tourPath(city.id) as Route);
    }
  }, [requestTour, pathname, router, city.id]);

  const handleTourFinish = useCallback(() => {
    setSteps(null);
    markSeen();
  }, [markSeen]);

  if (!isReady) return null;

  if (isTouring) {
    return <TourOverlay steps={steps} onFinish={handleTourFinish} />;
  }

  const showSheet =
    !hasSeen && !isConsentOpen && !isTourPending && isOnboardingRoute(pathname, isCityId);
  if (!showSheet) return null;

  return (
    <WelcomeSheet
      cityLocative={city.locativeForm[locale]}
      onSkip={markSeen}
      onStart={handleStart}
    />
  );
}
