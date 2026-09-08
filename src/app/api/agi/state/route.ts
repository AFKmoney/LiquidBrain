import { NextResponse } from "next/server";
import { callBackend, BACKEND_URL } from "@/lib/agi/backend";
import type { BrainState } from "@/lib/agi/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await callBackend<BrainState>("/api/state");

  if (!result.ok) {
    // status === null → unreachable (503); otherwise forward the backend status.
    return NextResponse.json(
      {
        status: result.status === null ? "offline" : "error",
        error: result.error,
        backend: BACKEND_URL,
      },
      { status: result.status ?? 503 }
    );
  }

  return NextResponse.json(result.data);
}
