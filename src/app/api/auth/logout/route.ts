import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";

export const runtime = "nodejs";

export async function POST() {
  const requestId = crypto.randomUUID();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true, requestId });
  return applyPrivacyHeaders(res);
}
