import { NextResponse } from "next/server";
import { guard, MEDIA_MAX_BYTES } from "@/lib/server/guard";
import { requestKeys } from "@/lib/server/keys";
import { getModelById } from "@/lib/models/registry";
import { chatCompletion } from "@/lib/models/providers";

export async function POST(request: Request) {
  const guarded = await guard(request, { scope: "media", maxBytes: MEDIA_MAX_BYTES });
  if (!guarded.ok) return guarded.response;

  try {
    const body = guarded.body as Record<string, any>;
    const imageUrl = body.imageUrl;
    const prompt = body.prompt || "Describe what you see in this image.";
    const modelId = body.model || "nvidia/nemotron-nano-12b-v2-vl";
    const apiKeys = requestKeys(request);

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    const model = getModelById(modelId);
    if (!model || !model.capabilities.includes("vision")) {
      return NextResponse.json({ error: "Invalid vision model" }, { status: 400 });
    }

    const response = await chatCompletion(
      model,
      {
        model: model.id,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      },
      apiKeys
    );

    return NextResponse.json({
      analysis: response.choices[0]?.message?.content || "No analysis generated.",
      model: modelId,
      prompt,
    });
  } catch (error: any) {
    console.error("[Vision Error]", error);
    return NextResponse.json(
      { error: error.message || "Vision analysis failed" },
      { status: 500 }
    );
  }
}
