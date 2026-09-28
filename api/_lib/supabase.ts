// Calls a Postgres function of the site's Supabase project through its REST API, with
// the public anon key (the same VITE_SUPABASE_* variables the browser build uses; Vercel
// Functions can read them at runtime). The functions it calls are SECURITY DEFINER and
// granted to anon on purpose — see supabase/migrations/0002, 0003 and 0004.

export function hasSupabase(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function supabaseKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
}

/** A refused call; status 404 means the function does not exist (its migration hasn't been run). */
export class RpcError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error("Supabase URL / anon key are not set");

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) throw new RpcError(`${fn} failed (${res.status}): ${(await res.text()).slice(0, 200)}`, res.status);
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}
