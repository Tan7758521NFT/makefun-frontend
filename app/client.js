// Read-only client for the public make.fun API.
//
// One rule drives this whole file: never fetch the same answer twice in a
// minute. Responses are cached in memory and revalidated with the ETag the
// API sends (its tags turn over once a minute), so a second view of the same
// page costs no request at all and a later one costs a 304 at most.

export const API_ORIGIN = 'https://make.fun';

// How long a cached answer counts as fresh before we revalidate it.
const FRESH_MS = 60_000;

// url -> { etag, data, at }
const cache = new Map();
// url -> Promise, so parallel renders of one view share a single request.
const inflight = new Map();

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function cacheKey(path) {
  return API_ORIGIN + path;
}

async function requestJson(path) {
  const url = cacheKey(path);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;
  if (inflight.has(url)) return inflight.get(url);

  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const task = fetch(url, { headers }).then(async (res) => {
    if (res.status === 304 && hit) {
      hit.at = Date.now();
      return hit.data;
    }
    if (res.status === 429) {
      throw new ApiError(429, 'The API asked us to slow down (rate limited). Try again in a moment.');
    }
    if (!res.ok) {
      throw new ApiError(res.status, `The API answered ${res.status} for ${path}.`);
    }
    const data = await res.json();
    cache.set(url, { etag: res.headers.get('ETag'), data, at: Date.now() });
    return data;
  }).finally(() => inflight.delete(url));
  inflight.set(url, task);
  return task;
}

// The board: every bounty that still takes entries, plus closed ones the
// API still lists, so the filter chips have something to work with.
export function listBounties() {
  return requestJson('/api/competitions?status=open&demo=exclude&limit=100');
}

export function bounty(slug) {
  return requestJson(`/api/competitions/${encodeURIComponent(slug)}`);
}

export function leaderboard(slug, view) {
  const query = view ? `?view=${encodeURIComponent(view)}` : '';
  return requestJson(`/api/competitions/${encodeURIComponent(slug)}/leaderboard${query}`);
}

export function profile(handle) {
  return requestJson(`/api/profiles/${encodeURIComponent(handle)}`);
}
