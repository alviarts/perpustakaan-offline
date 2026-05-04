/**
 * Theme-aware illustration backdrop for the Kunjungan page (revisi #6 + #18).
 *
 * Renders a low-opacity, vector-only "library reading" composition that
 * adapts to light + dark themes via `currentColor` and stays crisp at any
 * DPI. We deliberately keep this as inline SVG (rather than a 1024px+ raster
 * import from unDraw / Storyset) because:
 *   1. The Tauri WebView renders at the host display's native pixel ratio,
 *      so a vector backdrop never blurs on hi-DPI screens.
 *   2. `currentColor` lets the same illustration tint to the active theme
 *      primary in both light and dark modes — a baked-in PNG cannot.
 *   3. Inline SVG adds zero bytes to the asset bundle (~2 KB gz vs >150 KB
 *      for a PNG of comparable visual weight) and skips the asset:// CSP
 *      surface entirely.
 *
 * Visual elements: open book + reader silhouette (top-right), bookshelf
 * spine strip + leafy accent (bottom-left), and a faint trend line that
 * echoes the page's chart card.
 */
export function KunjunganBackdrop(): JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.07] dark:opacity-[0.10]"
      data-testid="kunjungan-backdrop"
    >
      {/* Top-right: open book + reading figure */}
      <svg
        className="text-primary absolute -right-10 -top-10 h-[440px] w-[440px]"
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="backdrop-reader"
      >
        {/* Concentric halo */}
        <circle cx="140" cy="100" r="92" stroke="currentColor" strokeWidth="1.5" />
        <circle
          cx="140"
          cy="100"
          r="68"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        {/* Open book — left page */}
        <path
          d="M70 130 L130 122 L130 178 L70 184 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Open book — right page */}
        <path
          d="M130 122 L190 130 L190 184 L130 178 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Page text lines */}
        <line
          x1="80"
          y1="142"
          x2="120"
          y2="138"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="80"
          y1="152"
          x2="118"
          y2="148"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="80"
          y1="162"
          x2="116"
          y2="158"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="140"
          y1="138"
          x2="180"
          y2="142"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="140"
          y1="148"
          x2="178"
          y2="152"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="140"
          y1="158"
          x2="174"
          y2="162"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Reading figure — head, shoulders, leaning silhouette */}
        <circle cx="130" cy="80" r="14" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M104 122 Q130 96 156 122"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Bottom-left: bookshelf + plant accent */}
      <svg
        className="text-primary absolute -bottom-12 -left-10 h-[380px] w-[380px]"
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="backdrop-shelf"
      >
        {/* Shelf base */}
        <line
          x1="20"
          y1="200"
          x2="220"
          y2="200"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Book spines, varied widths */}
        <rect x="30" y="150" width="14" height="50" stroke="currentColor" strokeWidth="1.6" />
        <rect x="48" y="160" width="10" height="40" stroke="currentColor" strokeWidth="1.6" />
        <rect x="62" y="140" width="18" height="60" stroke="currentColor" strokeWidth="1.6" />
        <rect x="84" y="155" width="12" height="45" stroke="currentColor" strokeWidth="1.6" />
        <rect x="100" y="148" width="16" height="52" stroke="currentColor" strokeWidth="1.6" />
        <rect x="120" y="158" width="10" height="42" stroke="currentColor" strokeWidth="1.6" />
        {/* Tilted book at the end */}
        <path
          d="M138 158 L156 154 L168 198 L150 200 Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* Plant pot + leaves */}
        <path
          d="M180 200 L182 175 L208 175 L210 200 Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M195 175 Q188 155 175 152"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M195 175 Q200 152 215 148"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M195 175 Q195 145 205 130"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Mid: faint trend echo */}
      <svg
        className="text-primary absolute left-1/2 top-1/2 h-[260px] w-[420px] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 420 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="backdrop-trend"
      >
        <path
          d="M20 200 Q90 100 160 150 T300 80 T400 130"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="4 6"
        />
        <circle cx="160" cy="150" r="3" fill="currentColor" />
        <circle cx="300" cy="80" r="3" fill="currentColor" />
        <circle cx="400" cy="130" r="3" fill="currentColor" />
      </svg>
    </div>
  );
}
