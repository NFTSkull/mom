import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness: el proceso responde. Sin consultas a DB/Auth/Storage.
 */
export async function GET() {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    { ok: true, status: "live", requestId },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    }
  );
}
