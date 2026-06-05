const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

let token: string | null = null;

export function setAdminToken(t: string) {
  token = t;
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_token", t);
  }
}

export function getAdminToken(): string | null {
  if (token) return token;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("admin_token");
  }
  return token;
}

export function clearAdminToken() {
  token = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = getAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, data };
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
};
