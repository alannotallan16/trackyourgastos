// Default loading state shown by Next.js during route navigation.
// A thin gradient bar across the top gives the user confirmation their tap
// was registered while the destination page loads.
export default function Loading() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden pointer-events-none"
    >
      <div className="h-full w-1/3 bg-brand-gradient animate-[loadingBar_1.4s_ease-in-out_infinite]" />
      <style>{`
        @keyframes loadingBar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
