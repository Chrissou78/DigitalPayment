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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const isPasswordValid = password.length >= 8;
  const isFormValid = isEmailValid && isPasswordValid;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string }>("/auth/admin-login", {
        email,
        password,
      });
      setAdminToken(res.accessToken);
      router.push("/dashboard");
    } catch (err: any) {
      const message =
        err?.data?.message || err?.message || "Unable to reach the server. Please try again later.";
      setError(typeof message === "string" ? message : "Login failed. Please check your credentials.");
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

        {/* Email */}
        <div className="mb-4">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full bg-surface-2 border rounded-lg px-4 py-3 text-ink text-sm outline-none transition-colors ${
              email && !isEmailValid
                ? "border-red focus:border-red"
                : "border-surface-3 focus:border-gold"
            }`}
          />
          {email && !isEmailValid && (
            <p className="text-red text-xs mt-1">Please enter a valid email address</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-6">
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full bg-surface-2 border rounded-lg px-4 py-3 text-ink text-sm outline-none transition-colors ${
              password && !isPasswordValid
                ? "border-red focus:border-red"
                : "border-surface-3 focus:border-gold"
            }`}
          />
          {password && !isPasswordValid && (
            <p className="text-red text-xs mt-1">Password must be at least 8 characters</p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-red text-xs text-center">{error}</p>
          </div>
        )}

        {/* Submit — disabled until form is valid */}
        <button
          type="submit"
          disabled={!isFormValid || loading}
          className={`w-full font-heading text-sm rounded-lg py-3 transition-all ${
            isFormValid && !loading
              ? "bg-gold text-bg hover:brightness-110 cursor-pointer"
              : "bg-surface-3 text-ink-muted cursor-not-allowed"
          }`}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
