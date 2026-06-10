"use client";

const ADMIN_STORAGE_KEY = "strava-admin-secret";
const ADMIN_HEADER = "x-admin-secret";

function getStoredAdminSecret() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) ?? "";
}

function askForAdminSecret() {
  if (typeof window === "undefined") return "";
  const secret = window.prompt("Senha administrativa do site:")?.trim() ?? "";
  if (secret) window.sessionStorage.setItem(ADMIN_STORAGE_KEY, secret);
  return secret;
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  const normalized: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function withAdminHeader(init: RequestInit, secret: string): RequestInit {
  if (!secret) return init;
  return {
    ...init,
    headers: {
      ...normalizeHeaders(init.headers),
      [ADMIN_HEADER]: secret,
    },
  };
}

export async function fetchWithAdminRetry(input: RequestInfo | URL, init: RequestInit = {}) {
  const firstSecret = getStoredAdminSecret();
  const firstResponse = await fetch(input, withAdminHeader(init, firstSecret));

  if (firstResponse.status !== 401) return firstResponse;

  const promptedSecret = askForAdminSecret();
  if (!promptedSecret) return firstResponse;

  return fetch(input, withAdminHeader(init, promptedSecret));
}
