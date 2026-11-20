// Default loading state shown by Next.js during route navigation.
// A gradient bar across the top + a faint full-width track gives the user
// confirmation their tap was registered while the destination page loads.
export default function Loading() {
  return (
    <>
      <div
        aria-live="polite"
        aria-busy="true"
        className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden pointer-events-none bg-brand-green/10"
      >
        <div className="h-full w-2/5 bg-brand-gradient rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-[loadingBar_1.1s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes loadingBar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(180%); }
          100% { transform: translateX(-100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-busy="true"] > div { animation: none; width: 100%; opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
