import { mongodb } from '../lib/mongodbClient';

/** Handwriting / cold Mongo can exceed short client races; keep reads/writes reliable. */
export const TEST_QUERY_TIMEOUT_MS = 15000;
export const TEST_INSERT_TIMEOUT_MS = 25000;

export function sanitizeTestForMongo<T extends Record<string, unknown>>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => {
      if (typeof v === 'number' && (!Number.isFinite(v) || Number.isNaN(v))) return null;
      return v;
    }),
  );
}

function extractInsertedId(res: { data?: unknown; error?: { message?: string } | null }): string | null {
  if (res?.error) return null;
  const d = res?.data;
  const row = Array.isArray(d) ? d[0] : d;
  if (row && typeof row === 'object' && row !== null && 'id' in row) {
    const id = (row as { id?: unknown }).id;
    if (id !== undefined && id !== null) return String(id);
  }
  return null;
}

/**
 * Insert into `tests` with a generous timeout and one retry after failures / timeouts.
 */
export async function insertTestRecord(record: Record<string, unknown>): Promise<{ id: string | null; error: string | null }> {
  const body = sanitizeTestForMongo(record);
  const run = () => {
    const insertPromise = (mongodb as any).from('tests').insert(body) as Promise<{ data?: unknown; error?: { message?: string } | null }>;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), TEST_INSERT_TIMEOUT_MS),
    );
    return Promise.race([insertPromise, timeoutPromise]);
  };

  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await run();
      const id = extractInsertedId(res);
      if (id) return { id, error: null };
      lastErr =
        res?.error && typeof res.error === 'object' && 'message' in res.error
          ? String((res.error as { message?: string }).message)
          : 'Insert failed';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'Database timeout';
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return { id: null, error: lastErr };
}
