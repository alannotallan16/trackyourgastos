export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white font-bold">L</div>
        <span className="text-xl font-semibold tracking-tight">LedgerLink</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-subtle">
        Track money owed to you and money you owe — installments, invoices, payment proof, and linked obligations.
      </p>
    </div>
  );
}
