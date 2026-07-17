interface SparkProps {
  size?: number;
  className?: string;
}

// 4-point starburst — "city energy" (brief §4). Inherits color via currentColor.
export default function Spark({ size = 24, className }: SparkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 2c.9 5.4 4.6 9.1 10 10-5.4.9-9.1 4.6-10 10-.9-5.4-4.6-9.1-10-10 5.4-.9 9.1-4.6 10-10z" />
    </svg>
  );
}
