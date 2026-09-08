import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { requestKeys } from "@/lib/server/keys";
import { getModelById } from "@/lib/models/registry";
import { textToSpeech } from "@/lib/models/providers";

export async function POST(request: Request) {
  // Throttled and origin-checked: these routes spend real credits.
  const guarded = await guard(request, { scope: "media" });
  if (!guarded.ok) return guarded.response;

  try {
    const body = guarded.body as Record<string, any>;
    const text = body.text;
    const modelId = body.model || "nvidia/magpie-tts-zeroshot";
    const apiKeys = requestKeys(request);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const model = getModelById(modelId);
    if (!model || model.category !== "tts") {
      return NextResponse.json({ error: "Invalid TTS model" }, { status: 400 });
    }

    const result = await textToSpeech(model, text, apiKeys);

    return NextResponse.json({
      audio: result.audio,
      audioType: result.audio_type || "wav",
      model: modelId,
      text,
    });
  } catch (error: any) {
    console.error("[TTS Error]", error);
    return NextResponse.json(
      { error: error.message || "TTS failed" },
      { status: 500 }
    );
  }
}
