"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(search.get("next") || "/dashboard");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback` }
        });
        if (error) throw error;
        setMsg("Check your email for the sign-in link.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-md">
      <div className="flex flex-col items-center text-center pb-2">
        <BrandLogo variant="full" />
      </div>
      <p className="text-sm text-slate-500 mb-6 text-center">Sign in to continue.</p>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {mode === "password" && (
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        )}

        {error && <p className="text-sm text-brand-danger">{error}</p>}
        {msg && <p className="text-sm text-brand-green">{msg}</p>}

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : mode === "password" ? "Sign in" : "Send magic link"}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 block w-full text-center text-sm text-brand-green hover:underline"
        onClick={() => setMode((m) => (m === "password" ? "magic" : "password"))}
      >
        {mode === "password" ? "Use magic link instead" : "Use password instead"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <Suspense fallback={<div className="card w-full max-w-md">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
