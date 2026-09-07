import { NextResponse } from "next/server";
import { callBackend } from "@/lib/agi/backend";
import type { ReflectResponse } from "@/lib/agi/types";

const EMPTY: ReflectResponse & { error?: string } = {
  coherence: 0,
  avg_surprise: 0,
  avg_confidence: 0,
  should_rewire: false,
  insight: null,
  memory_utilization: 0,
};

export async function POST() {
  const result = await callBackend<ReflectResponse>("/api/reflect", {
    method: "POST",
    body: {},
  });

  if (!result.ok) {
    return NextResponse.json({ ...EMPTY, error: result.error }, { status: result.status ?? 503 });
  }

  return NextResponse.json(result.data);
}
