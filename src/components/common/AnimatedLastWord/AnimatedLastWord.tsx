'use client';

import { useEffect, useState } from 'react';
import styles from './AnimatedLastWord.module.scss';

interface AnimatedLastWordProps {
  text: string;
  // Optional override for accessibility — if omitted, the rendered text is
  // used as the accessible name.
  ariaLabel?: string;
}

// Duration of the roll; kept in sync with the CSS animation below.
const ROLL_MS = 650;

// Renders a single word that "rolls" whenever its `text` prop changes, like a
// split-flap / slot display: the outgoing word slides up and out of a one-line
// window while the incoming word rolls up into it. Only one word ever occupies
// the window, so the two never overlap in place. The first paint matches
// whatever `text` is on mount (no entry animation), so SSR/hydration stays
// stable.
export default function AnimatedLastWord({ text, ariaLabel }: AnimatedLastWordProps) {
  const [current, setCurrent] = useState(text);
  const [previous, setPrevious] = useState<string | null>(null);
  // Bumped on every swap so the roller remounts and the CSS animation replays,
  // even when the same string appears twice in a row.
  const [seq, setSeq] = useState(0);
  // Tracks the prop value we last reacted to — adjusting state during render is
  // the React-recommended pattern for deriving state from a changing prop.
  const [lastSeenText, setLastSeenText] = useState(text);

  if (text !== lastSeenText) {
    setLastSeenText(text);
    setPrevious(current);
    setCurrent(text);
    setSeq(seq + 1);
  }

  // Drop the outgoing word once the roll has finished so the window holds just
  // the current word at rest.
  useEffect(() => {
    if (previous === null) return;
    const id = window.setTimeout(() => setPrevious(null), ROLL_MS + 60);
    return () => window.clearTimeout(id);
  }, [previous, seq]);

  const rolling = previous !== null;

  return (
    <span className={styles.wrapper} aria-label={ariaLabel ?? text} role="text">
      <span key={seq} className={styles.roller} data-rolling={rolling}>
        {rolling && (
          <span className={styles.line} aria-hidden="true">
            {previous}
          </span>
        )}
        <span className={styles.line} aria-hidden="true">
          {current}
        </span>
      </span>
    </span>
  );
}
