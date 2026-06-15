import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8080";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/reflect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { coherence: 0, avg_surprise: 0, avg_confidence: 0, should_rewire: false, insight: null, memory_utilization: 0, error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { coherence: 0, avg_surprise: 0, avg_confidence: 0, should_rewire: false, insight: null, memory_utilization: 0, error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
