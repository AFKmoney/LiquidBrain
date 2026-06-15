import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8080";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/memory`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { concepts: [], total: 0, error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { concepts: [], total: 0, error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
