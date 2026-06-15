import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8080";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycles: body.cycles || 5 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { cycles_run: 0, active_nodes: 0, error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { cycles_run: 0, active_nodes: 0, error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
