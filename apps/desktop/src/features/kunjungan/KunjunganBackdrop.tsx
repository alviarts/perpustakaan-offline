/**
 * Transparent SVG illustration backdrop (revisi #18).
 *
 * Placeholder asset until Devin 12 swaps in unDraw / Storyset PNG (revisi #6).
 * Theme-aware via `currentColor`.
 */
export function KunjunganBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.06] dark:opacity-[0.08]"
      data-testid="kunjungan-backdrop"
    >
      <svg
        className="absolute -right-12 -top-12 h-[420px] w-[420px] text-primary"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="2" />
        <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="2" />
        <path
          d="M40 110 Q100 50 160 110"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="60" y="115" width="80" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
        <line x1="70" y1="125" x2="130" y2="125" stroke="currentColor" strokeWidth="1.5" />
        <line x1="70" y1="135" x2="120" y2="135" stroke="currentColor" strokeWidth="1.5" />
        <line x1="70" y1="145" x2="110" y2="145" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg
        className="absolute -bottom-16 -left-12 h-[360px] w-[360px] text-primary"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M30 160 L90 80 L130 130 L170 60"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="90" cy="80" r="6" fill="currentColor" />
        <circle cx="130" cy="130" r="6" fill="currentColor" />
        <circle cx="170" cy="60" r="6" fill="currentColor" />
      </svg>
    </div>
  );
}
