"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setAdminToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ access_token: string }>("/auth/admin-login", {
        email,
        password,
      });
      setAdminToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.data?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form
        onSubmit={handleLogin}
        className="bg-surface rounded-2xl p-8 w-full max-w-sm"
      >
        <h1 className="font-heading text-gold text-2xl mb-1">PayDuka</h1>
        <p className="text-ink-muted text-sm mb-8">Admin Console</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-3 text-ink text-sm mb-4 outline-none focus:border-gold transition-colors"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-3 text-ink text-sm mb-6 outline-none focus:border-gold transition-colors"
        />

        {error && (
          <p className="text-red text-xs mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold text-bg font-heading text-sm rounded-lg py-3 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
