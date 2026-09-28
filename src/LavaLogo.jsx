import React from "react";

/** LAVA wordmark — geometric chevron letterforms in the Lava brand red. */
export default function LavaLogo({ height = 22, color = "#FF0047", className = "" }) {
  return (
    <svg
      viewBox="0 0 565 100"
      height={height}
      width={height * 5.65}
      className={className}
      role="img"
      aria-label="LAVA"
      fill={color}
    >
      <path d="M10 0 L52 0 L52 65 L125 65 L95 100 L25 100 L10 85 Z" />
      <path d="M100 100 L190 0 L210 0 L300 100 L255 100 L200 45 L145 100 Z" />
      <path d="M250 0 L340 100 L360 100 L450 0 L405 0 L350 55 L295 0 Z" />
      <path d="M355 100 L445 0 L465 0 L555 100 L510 100 L455 45 L400 100 Z" />
    </svg>
  );
}
