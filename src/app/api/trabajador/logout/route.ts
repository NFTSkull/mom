import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";
import {
  buildClearedSessionCookieOptions,
  getSessionCookieName,
} from "@/lib/nom035/server/evaluation-session";

export const runtime = "nodejs";

export async function POST() {
  const requestId = crypto.randomUUID();
  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const c of items) cookieStore.set(c.name, c.value, c.options);
      },
    },
  });
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true, requestId });
  res.cookies.set({
    name: getSessionCookieName(),
    value: "",
    ...buildClearedSessionCookieOptions(),
  });
  return applyPrivacyHeaders(res);
}
