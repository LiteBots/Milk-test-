// Wywołania API z przeglądarki – zwraca dane albo rzuca błąd z czytelnym komunikatem
export async function api<T = Record<string, unknown>>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: 'no-store',
      credentials: 'same-origin'
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { success?: boolean; message?: string };
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || 'Coś poszło nie tak. Spróbuj ponownie.') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}
