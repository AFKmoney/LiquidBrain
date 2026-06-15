import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8080";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/perceive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: body.input || body.message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { embedding_dim: 0, perceived: false, memory_stored: false, error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { embedding_dim: 0, perceived: false, memory_stored: false, error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
