const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Nest's error responses are JSON like {"statusCode":409,"message":"...","error":"Conflict"}
// (or message as string[] for class-validator failures) — surface that message
// directly instead of the raw JSON blob, since callers show it to the user as-is.
async function parseErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  if (!raw) return `Something went wrong (${res.status}). Please try again.`;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.message)) return parsed.message.join(' ');
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Not JSON — fall through to the raw text below.
  }
  return raw;
}

export async function fetchApi(path: string, options: RequestInit = {}) {
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('sn_token') || '';
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  return res.json();
}

// For endpoints that return a non-JSON body (e.g. the HTML invoice) — a plain
// <a href> can't send the bearer token, so this fetches it with auth and
// hands back a Blob the caller can open via an object URL.
export async function fetchApiBlob(path: string): Promise<Blob> {
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('sn_token') || '';
  }

  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  return res.blob();
}