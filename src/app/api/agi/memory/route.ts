import { NextResponse } from "next/server";
import { callBackend } from "@/lib/agi/backend";
import type { MemoryResponse } from "@/lib/agi/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await callBackend<MemoryResponse>("/api/memory");

  if (!result.ok) {
    return NextResponse.json(
      { concepts: [], total: 0, error: result.error },
      { status: result.status ?? 503 }
    );
  }

  return NextResponse.json(result.data);
}
