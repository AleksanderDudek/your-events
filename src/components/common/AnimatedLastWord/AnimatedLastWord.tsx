'use client';

import { useEffect, useState } from 'react';
import styles from './AnimatedLastWord.module.scss';

interface AnimatedLastWordProps {
  text: string;
  // Optional override for accessibility — if omitted, the rendered text is
  // used as the accessible name.
  ariaLabel?: string;
}

// Renders a single word that smoothly morphs whenever its `text` prop changes:
// the previous word slides up + blurs out while the new word slides up + blurs
// into place. The first paint matches whatever `text` is on mount (no entry
// animation), so SSR/hydration stays stable.
export default function AnimatedLastWord({ text, ariaLabel }: AnimatedLastWordProps) {
  const [current, setCurrent] = useState(text);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  // Bumped on every swap so identical strings still produce unique keys for
  // the incoming/outgoing spans (forcing a remount and re-triggering CSS
  // animations).
  const [animSeq, setAnimSeq] = useState(0);
  // Tracks the prop value we last reacted to. When `text` changes, we adjust
  // state during render — the React-recommended pattern for derived state
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [lastSeenText, setLastSeenText] = useState(text);

  if (text !== lastSeenText) {
    setLastSeenText(text);
    setOutgoing(current);
    setCurrent(text);
    setAnimSeq(animSeq + 1);
  }

  useEffect(() => {
    if (outgoing === null) return;
    const id = window.setTimeout(() => setOutgoing(null), 800);
    return () => window.clearTimeout(id);
  }, [outgoing, current]);

  return (
    <span
      className={styles.wrapper}
      aria-label={ariaLabel ?? text}
      // Once we expose an aria-label the animated layers are purely decorative;
      // hide the duplicated outgoing word from assistive tech.
      role="text"
    >
      <span className={styles.measure} aria-hidden="true">{current}</span>
      <span
        key={`in-${animSeq}-${current}`}
        className={`${styles.layer} ${styles.incoming}`}
        aria-hidden="true"
      >
        {current}
      </span>
      {outgoing !== null && (
        <span
          key={`out-${animSeq}-${outgoing}`}
          className={`${styles.layer} ${styles.outgoing}`}
          aria-hidden="true"
        >
          {outgoing}
        </span>
      )}
    </span>
  );
}
