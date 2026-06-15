import { NextResponse } from "next/server";
import { getModelById } from "@/lib/models/registry";
import { textToSpeech } from "@/lib/models/providers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text;
    const modelId = body.model || "nvidia/magpie-tts-zeroshot";
    const apiKeys = body.apiKeys || {};

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
