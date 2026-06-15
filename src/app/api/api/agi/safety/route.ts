import { NextResponse } from "next/server";
import { getModelById } from "@/lib/models/registry";
import { safetyCheck } from "@/lib/models/providers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text;
    const modelId = body.model || "nvidia/nemotron-3.5-content-safety";
    const apiKeys = body.apiKeys || {};

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
