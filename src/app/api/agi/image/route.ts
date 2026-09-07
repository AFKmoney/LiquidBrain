import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { requestKeys } from "@/lib/server/keys";
import { getModelById } from "@/lib/models/registry";
import { imageGeneration } from "@/lib/models/providers";

export async function POST(request: Request) {
  // Throttled and origin-checked: these routes spend real credits.
  const guarded = await guard(request, { scope: "media" });
  if (!guarded.ok) return guarded.response;

  try {
    const body = guarded.body as Record<string, any>;
    const prompt = body.prompt;
    const modelId = body.model || "black-forest-labs/flux.1-schnell";
    const apiKeys = requestKeys(request);

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const model = getModelById(modelId);
    if (!model || model.category !== "image-gen") {
      return NextResponse.json({ error: "Invalid image generation model" }, { status: 400 });
    }

    const result = await imageGeneration(model, prompt, apiKeys);

    return NextResponse.json({
      images: result.data,
      model: modelId,
      prompt,
    });
  } catch (error: any) {
    console.error("[Image Gen Error]", error);
    return NextResponse.json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
}
