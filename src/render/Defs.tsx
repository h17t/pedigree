import { tagColor } from '@/design/tokens';

/** Shared SVG definitions: black-and-white patterns for the branch stripes. */
export function Defs({ ink = '#1B2733' }: { ink?: string }) {
  return (
    <defs>
      <pattern id="pat-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#fff" />
        <rect width="3" height="6" fill={ink} />
      </pattern>
      <pattern id="pat-dots" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#fff" />
        <circle cx="3" cy="3" r="1.6" fill={ink} />
      </pattern>
      <pattern id="pat-hlines" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#fff" />
        <rect width="6" height="2" fill={ink} />
      </pattern>
      <pattern id="pat-vlines" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#fff" />
        <rect width="2" height="6" fill={ink} />
      </pattern>
      <pattern id="pat-cross" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#fff" />
        <path d="M0 4h8M4 0v8" stroke={ink} strokeWidth="1.5" />
      </pattern>
      <pattern id="pat-solid" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill={ink} />
      </pattern>
      {Object.entries(tagColor).map(([name, hex]) => (
        <pattern key={name} id={`tag-${name}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={hex} />
        </pattern>
      ))}
    </defs>
  );
}
