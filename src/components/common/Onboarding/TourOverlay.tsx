'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '@/i18n';
import type { TourStep } from '@/lib/tourSteps';
import styles from './TourOverlay.module.scss';

interface TourOverlayProps {
  /** Already filtered to steps whose anchors existed when the tour started. */
  steps: TourStep[];
  /** Called once, whether the visitor finished, skipped or pressed Esc. */
  onFinish: () => void;
}

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Breathing room between the highlighted control and the lit edge.
const HOLE_PADDING = 8;

function holeFrom(el: Element): Hole {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - HOLE_PADDING,
    left: rect.left - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  };
}

/**
 * The spotlight walkthrough: a dimmed page with one control lit at a time and a
 * tooltip explaining it.
 *
 * The overlay reads the DOM rather than receiving refs, so the five components
 * it points at carry a `data-tour` attribute and no tour logic at all.
 */
export default function TourOverlay({ steps, onFinish }: TourOverlayProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Guards the "call onFinish exactly once" promise: Esc during the closing
  // frame, or a step that vanishes at the same moment, could otherwise mark the
  // tour seen twice.
  const finishedRef = useRef(false);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const step = steps[index];

  // Resolve the anchor for the current step. A step whose control has gone
  // (the viewport crossed the md breakpoint mid-tour and the sidebar became a
  // Fab) is skipped rather than shown against a dead rectangle.
  useEffect(() => {
    if (!step) {
      finish();
      return;
    }
    const el = document.querySelector<HTMLElement>(step.selector);
    if (!el) {
      setIndex((current) => current + 1);
      return;
    }
    // Instant, not smooth: a smooth scroll would still be moving while the hole
    // is measured, so the spotlight would land next to the control instead of
    // on it.
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    setAnchor(el);
    setHole(holeFrom(el));
  }, [step, finish]);

  // The page keeps scrolling under the tour — locking it would strand anyone
  // who wants to see the control in context — so the hole follows its anchor.
  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      if (!anchor.isConnected) {
        setIndex((current) => current + 1);
        return;
      }
      setHole(holeFrom(anchor));
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);

  // Focus follows the step, so a keyboard or screen-reader user is reading the
  // tooltip they just advanced to rather than the page behind it.
  //
  // Two mechanisms, because the panel does not exist on the first render: the
  // hole is measured in an effect, so the first pass returns null and an effect
  // firing then would find an empty ref. The callback ref covers "the panel has
  // just appeared"; the effect covers "the same panel now shows a later step".
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    node?.focus();
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [finish]);

  const isLast = index >= steps.length - 1;
  const next = () => (isLast ? finish() : setIndex((current) => current + 1));
  const back = () => setIndex((current) => Math.max(0, current - 1));

  // Tab stays inside the tooltip. Without this the tour dims the page but the
  // keyboard still walks into it, which is how a walkthrough turns into a trap
  // of the wrong kind — focus somewhere invisible behind the scrim.
  const keepFocusInside = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!step || !hole) return null;

  const copy = t.ONBOARDING_STEPS[step.id];

  return (
    <>
      {/* Swallows clicks so the highlighted control cannot be operated out from
          under the tour. Not labelled: the tooltip beside it is the dialog. */}
      <Box className={styles.scrim} aria-hidden="true" onClick={(e) => e.stopPropagation()} />
      <Box
        className={styles.hole}
        aria-hidden="true"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
      />
      <Popper
        open
        anchorEl={anchor}
        placement={step.placement}
        className={styles.tooltip}
        // The placement on a step is a preference, not a promise. The filters
        // step anchors to a sidebar on desktop and to a bottom-right Fab on a
        // phone, where "to the right of it" is off the screen entirely — so the
        // tooltip is allowed to flip to any side and, failing that, to slide
        // along the cross axis until it fits.
        modifiers={[
          { name: 'offset', options: { offset: [0, 16] } },
          {
            name: 'flip',
            options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'], padding: 12 },
          },
          { name: 'preventOverflow', options: { padding: 12, altAxis: true, tether: false } },
        ]}
      >
        <Box
          ref={attachPanel}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          tabIndex={-1}
          onKeyDown={keepFocusInside}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography component="span" className={styles.count} aria-live="polite">
                {t.ONBOARDING_STEP_COUNT(index + 1, steps.length)}
              </Typography>
              <Typography id="tour-step-title" component="h2" className={styles.title}>
                {copy.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={finish} aria-label={t.ONBOARDING_CLOSE}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Typography className={styles.body}>{copy.body}</Typography>

          <Box className={styles.actions}>
            <Button size="small" onClick={finish} sx={{ color: 'var(--color-text-secondary)' }}>
              {t.ONBOARDING_SKIP}
            </Button>
            <span className={styles.spacer} />
            {index > 0 && (
              <Button size="small" variant="outlined" onClick={back}>
                {t.ONBOARDING_BACK}
              </Button>
            )}
            <Button size="small" variant="contained" onClick={next}>
              {isLast ? t.ONBOARDING_DONE : t.ONBOARDING_NEXT}
            </Button>
          </Box>
        </Box>
      </Popper>
    </>
  );
}
