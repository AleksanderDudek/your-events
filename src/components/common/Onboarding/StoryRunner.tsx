'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useCategories } from '@/components/service/useCategories';
import { usePresets } from '@/components/service/usePresets';
import { useFilterNavigation } from '@/components/service/useFilterNavigation';
import { useCity } from '@/config/CityProvider';
import { MY_FILTERS_PATH } from '@/config/community';
import { useTranslation } from '@/i18n';
import { newPresetId, presetHref } from '@/lib/presets';
import {
  STORY_HOUR_FROM_LATER,
  storyFilterPatch,
  storyPresetFilters,
  type TourStep,
} from '@/lib/tourSteps';
import type { FilterPreset } from '@/types/preset.types';
import TourOverlay from './TourOverlay';

interface StoryRunnerProps {
  steps: TourStep[];
  onFinish: () => void;
}

/**
 * Performs the story the walkthrough tells: writes the filters, saves the
 * preset, walks to Moje filtry, opens it, edits it.
 *
 * Split out of `Onboarding` rather than living in it, because this is where the
 * expensive dependencies are — the categories query, the presets store, the
 * filter router. `Onboarding` is mounted in AppLayout on every page of the
 * site, and for all but a handful of visits it has nothing to do; subscribing
 * every one of those pages to react-query for a dormant feature is a cost with
 * no buyer. This component only exists once the visitor has asked for the tour.
 */
export default function StoryRunner({ steps, onFinish }: StoryRunnerProps) {
  const router = useRouter();
  const { city } = useCity();
  const { t } = useTranslation();
  const { bySlug } = useCategories();
  const { presets, save } = usePresets();
  const { updateFilters } = useFilterNavigation();

  const availableCategories = useMemo(() => Array.from(bySlug.keys()), [bySlug]);

  // One id for the whole run, so "save", "open" and "edit" all address the same
  // preset. A ref, not state: it must not trigger a render, and it must survive
  // the trip to Moje filtry and back — which it does, because AppLayout (and so
  // this component) stays mounted across client navigation.
  const presetIdRef = useRef<string | null>(null);

  /** The story's preset as it stands, whether or not storage has it yet. */
  const storyPreset = useCallback(
    (hourFrom?: string): FilterPreset => {
      const id = (presetIdRef.current ??= newPresetId());
      const stored = presets.find((p) => p.id === id);
      const base: FilterPreset = stored ?? {
        id,
        name: t.ONBOARDING_PRESET_NAME,
        cityId: city.id,
        filters: storyPresetFilters(availableCategories),
        createdAt: new Date().toISOString(),
      };
      return hourFrom ? { ...base, filters: { ...base.filters, hourFrom } } : base;
    },
    [presets, t, city.id, availableCategories]
  );

  // Every side effect the script can ask for, in one place. The steps stay pure
  // data; this is the only code that routes, writes filters or touches storage.
  const runStep = useCallback(
    (step: TourStep) => {
      switch (step.action.kind) {
        case 'none':
          return;

        case 'filter':
          updateFilters(storyFilterPatch(step.action.stage, new Date(), availableCategories));
          return;

        case 'savePreset':
          save(storyPreset());
          return;

        case 'goToPresets':
          router.push(MY_FILTERS_PATH as Route);
          return;

        case 'openPreset':
          // Straight to the preset's own URL — the same link its tile carries,
          // so the story opens the preset exactly the way the visitor will.
          router.push(presetHref(storyPreset(), new Date()) as Route);
          return;

        case 'editPresetHours':
          // Two things at once, because the step is "you changed jobs": the
          // saved preset moves to the later hour AND we go back to Moje filtry,
          // which is where the visitor would have made that edit themselves.
          save(storyPreset(STORY_HOUR_FROM_LATER));
          router.push(MY_FILTERS_PATH as Route);
          return;
      }
    },
    [updateFilters, availableCategories, save, storyPreset, router]
  );

  return <TourOverlay steps={steps} onStepEnter={runStep} onFinish={onFinish} />;
}
