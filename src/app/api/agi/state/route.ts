import { NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8080";

export async function GET() {
  try {
    console.log("[AGI Proxy] Fetching state from", `${BACKEND_URL}/api/state`);
    const res = await fetch(`${BACKEND_URL}/api/state`, {
      signal: AbortSignal.timeout(8000),
    });
    console.log("[AGI Proxy] Response status:", res.status);
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[AGI Proxy] Error:", err);
    return NextResponse.json(
      { status: "offline", error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
