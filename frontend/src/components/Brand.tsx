import type { IconName } from "../onboarding-data";

export function PixelIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    trophy: (
      <>
        <path d="M6 3h12v5c0 4-2 6-6 6s-6-2-6-6V3Z" />
        <path d="M6 6H3v2c0 3 2 4 5 4M18 6h3v2c0 3-2 4-5 4M9 21h6M12 14v7" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="m14 10 6-6M16 4h4v4" />
      </>
    ),
    book: (
      <>
        <path d="M4 5c3-1 6 0 8 2v14c-2-2-5-3-8-2V5ZM20 5c-3-1-6 0-8 2v14c2-2 5-3 8-2V5Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
      </>
    ),
    bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />,
    flag: (
      <>
        <path d="M5 22V3M5 4h13l-3 4 3 4H5" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15 9-2 5-5 2 2-5 5-2Z" />
      </>
    ),
    gem: (
      <>
        <path d="m4 8 4-5h8l4 5-8 13L4 8Z" />
        <path d="m4 8 8 3 8-3M8 3l4 8 4-8" />
      </>
    ),
    sword: (
      <>
        <path d="m20 3-3 8-8 8-4-4 8-8 7-4ZM7 13l4 4M4 18l2 2" />
      </>
    ),
    light: (
      <>
        <path d="M9 17h6M10 21h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z" />
      </>
    ),
    steps: <path d="M3 20h5v-5h5v-5h5V5h3" />,
    pause: (
      <>
        <path d="M7 4h4v16H7zM14 4h4v16h-4z" />
      </>
    ),
    cards: (
      <>
        <rect x="4" y="5" width="11" height="15" rx="1" />
        <path d="m8 5 1-2h11v15l-5 1M8 10h3M8 14h3" />
      </>
    ),
    puzzle: (
      <path d="M4 4h6v3a2 2 0 1 0 4 0V4h6v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4V4Z" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    blocks: (
      <>
        <rect x="3" y="13" width="8" height="8" />
        <rect x="13" y="13" width="8" height="8" />
        <rect x="8" y="3" width="8" height="8" />
      </>
    ),
    brain: (
      <path d="M9 5a4 4 0 0 0-5 4c0 1 .4 2 1 3a4 4 0 0 0 4 6c1 2 4 2 5 0a4 4 0 0 0 4-6c.6-1 1-2 1-3a4 4 0 0 0-5-4c-1-2-4-2-5 0ZM12 4v16M8 9h4M12 14h4" />
    ),
    heart: <path d="M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z" />,
    fire: (
      <path d="M13 22c5-1 7-4 7-8 0-5-4-8-7-12 0 4-2 6-4 8 0-2-1-3-2-4-2 3-3 5-3 8 0 4 3 7 7 8-2-2-2-5 1-7 0 3 2 3 1 7Z" />
    ),
    spark: (
      <>
        <path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" />
        <path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C10 4 5 9 5 16c5 2 12 0 15-12Z" />
        <path d="M4 21c3-7 8-9 13-12" />
      </>
    ),
  };
  return (
    <svg className="pixel-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`project-brand ${compact ? "compact" : ""}`}><img src="/trikup-logo.jpg" alt="TriKUp - by kAIzen" />{!compact && <small>by kAIzen</small>}</div>;
}

