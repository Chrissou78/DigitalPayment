import Constants from "expo-constants";
import { useAuthStore } from "@/stores/auth";

const BASE = Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:3000/api/v1";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = opts;
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data as T;
}

// Convenience wrappers
export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body });
