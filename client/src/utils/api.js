const PROD_FALLBACK_API_URL = 'https://nexstay-hotel-nuxh.onrender.com';

const rawApiEnv =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PROD_FALLBACK_API_URL : '');

export const API_BASE_URL = String(rawApiEnv || '').trim().replace(/\/+$/, '');

const rawSocketEnv = import.meta.env.VITE_SOCKET_URL || '';
export const SOCKET_URL =
  String(rawSocketEnv || API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '') || undefined;

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

// Track slow requests & connectivity (Render Free Tier ~50s cold-start awareness)
const wakeListeners = new Set();
const connectivityListeners = new Set();
let pendingSlowCount = 0;

function emitWakeState(isWaking) {
  wakeListeners.forEach((cb) => {
    try {
      cb(isWaking);
    } catch {
      // ignore listener errors
    }
  });
}

function emitConnectivity(isReachable) {
  connectivityListeners.forEach((cb) => {
    try {
      cb(isReachable);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeApiWakeState(cb) {
  wakeListeners.add(cb);
  return () => wakeListeners.delete(cb);
}

export function subscribeApiConnectivity(cb) {
  connectivityListeners.add(cb);
  return () => connectivityListeners.delete(cb);
}

async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resilient fetch wrapper for Render Free Tier cold starts & safe JSON error parsing.
 * - Retries transient 502/503/504 or network boot errors on idempotent GET calls across the timeout window.
 * - Signals global "waking up" state when a request takes longer than 2.8s.
 * - Enforces an AbortController timeout (default 55s to allow ~50s cold starts).
 */
export async function apiFetch(path, options = {}) {
  const {
    timeoutMs = 55000,
    retries,
    wakeThresholdMs = 2800,
    ...fetchOptions
  } = options;

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const maxRetries = isBrowserOffline
    ? 0
    : retries !== undefined
    ? retries
    : method === 'GET'
    ? 10
    : 0;
  const url = apiUrl(path);
  const startTime = Date.now();

  let markedSlow = false;
  const slowTimer = setTimeout(() => {
    markedSlow = true;
    pendingSlowCount += 1;
    if (pendingSlowCount === 1) emitWakeState(true);
  }, wakeThresholdMs);

  const cleanupSlow = () => {
    clearTimeout(slowTimer);
    if (markedSlow) {
      markedSlow = false;
      pendingSlowCount = Math.max(0, pendingSlowCount - 1);
      if (pendingSlowCount === 0) emitWakeState(false);
    }
  };

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const elapsed = Date.now() - startTime;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 0) {
        emitConnectivity(false);
        const timeoutErr = new Error('Server request timed out while waking up. Please try again.');
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), remaining);

      try {
        const res = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });
        clearTimeout(abortTimer);

        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
          const delay = Math.min(5000, 2000 + attempt * 600);
          if (Date.now() - startTime + delay < timeoutMs - 500) {
            await sleep(delay);
            continue;
          }
        }

        const data = await parseResponseBody(res);

        if (data && typeof data.rawText === 'string') {
          if (res.status >= 502) emitConnectivity(false);
          const err = new Error(
            res.status >= 502
              ? `Backend server is waking up or temporarily unavailable (HTTP ${res.status}).`
              : `Invalid response from API server (HTTP ${res.status}).`
          );
          err.status = res.status;
          throw err;
        }

        emitConnectivity(true);

        if (!res.ok) {
          const message =
            data?.message ||
            data?.error ||
            (res.status >= 502
              ? `Backend server is waking up or temporarily unavailable (HTTP ${res.status}).`
              : `HTTP ${res.status}`);
          const err = new Error(message);
          err.status = res.status;
          err.data = data;
          throw err;
        }

        return data;
      } catch (err) {
        clearTimeout(abortTimer);

        if (err.name === 'AbortError') {
          emitConnectivity(false);
          const timeoutErr = new Error('Request timed out (backend may still be waking up). Please retry.');
          timeoutErr.isTimeout = true;
          throw timeoutErr;
        }

        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(5000, 2000 + attempt * 600);
          if (Date.now() - startTime + delay < timeoutMs - 500) {
            await sleep(delay);
            continue;
          }
        }

        if (isNetworkError) {
          emitConnectivity(false);
          const netErr = new Error('Unable to reach backend server. Render Free Tier may be spinning up.');
          netErr.isNetwork = true;
          throw netErr;
        }

        throw err;
      }
    }

    emitConnectivity(false);
    throw new Error('Request failed after retries.');
  } finally {
    cleanupSlow();
  }
}
