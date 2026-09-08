import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { requestKeys } from "@/lib/server/keys";
import { getModelById } from "@/lib/models/registry";
import { safetyCheck } from "@/lib/models/providers";

export async function POST(request: Request) {
  // Throttled and origin-checked: these routes spend real credits.
  const guarded = await guard(request, { scope: "safety" });
  if (!guarded.ok) return guarded.response;

  try {
    const body = guarded.body as Record<string, any>;
    const text = body.text;
    const modelId = body.model || "nvidia/nemotron-3.5-content-safety";
    const apiKeys = requestKeys(request);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const model = getModelById(modelId);
    if (!model || model.category !== "safety") {
      return NextResponse.json({ error: "Invalid safety model" }, { status: 400 });
    }

    const result = await safetyCheck(model, text, apiKeys);

    return NextResponse.json({
      ...result,
      model: modelId,
      text,
    });
  } catch (error: any) {
    console.error("[Safety Check Error]", error);
    return NextResponse.json(
      { error: error.message || "Safety check failed" },
      { status: 500 }
    );
  }
}
