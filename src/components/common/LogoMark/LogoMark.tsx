interface LogoMarkProps {
  size?: number;
  className?: string;
}

// Brand symbol (brief §4): a map pin holding a 4-bar skyline, with a spark on a
// thin antenna above the tallest bar — "a place in the city where something is
// happening". Single evenodd path so it renders as one shape in currentColor;
// the caller sets `color` (--primary on light and dark alike).
//
// Below 16px the bars and antenna mush together — use <Spark /> for those
// inline spots (footer bullets, meta rows) rather than shrinking this.
export default function LogoMark({ size = 24, className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M24 3.5a15.5 15.5 0 0 1 15.5 15.5c0 10.9-15.5 25.5-15.5 25.5S8.5 29.9 8.5 19A15.5 15.5 0 0 1 24 3.5zM16.1 28.5v-5.5h3.1v5.5zM20.35 28.5v-8.5h3.1v8.5zM24.6 28.5v-11h3.1v11zM28.85 28.5v-6.5h3.1v6.5zM25.85 15.1h.6v2.4h-.6zM24.4 6.15c.31 1.94 1.63 3.26 3.57 3.57-1.94.31-3.26 1.63-3.57 3.57-.31-1.94-1.63-3.26-3.57-3.57 1.94-.31 3.26-1.63 3.57-3.57z" />
    </svg>
  );
}
