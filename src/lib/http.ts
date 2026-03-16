export type FetchLike = typeof fetch;

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  accept: "application/json, text/html;q=0.9, */*;q=0.8",
} as const;

export const fetchText = async (
  fetchImpl: FetchLike,
  url: string,
  init?: RequestInit,
) => {
  const response = await fetchImpl(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...DEFAULT_HEADERS,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
};

export const fetchJson = async <T>(
  fetchImpl: FetchLike,
  url: string,
  init?: RequestInit,
) => {
  const response = await fetchImpl(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...DEFAULT_HEADERS,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
};
