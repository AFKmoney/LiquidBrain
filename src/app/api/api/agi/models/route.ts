import { NextResponse } from "next/server";
import { getModelById, MODEL_REGISTRY, getModelsByCategory } from "@/lib/models/registry";

export async function GET() {
  // Return all available models grouped by category
  const models = MODEL_REGISTRY.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    category: m.category,
    capabilities: m.capabilities,
    description: m.description,
    contextWindow: m.contextWindow,
    isFree: m.isFree,
    requiresApiKey: m.requiresApiKey,
    apiKeyName: m.apiKeyName,
    params: m.params,
    tags: m.tags,
  }));

  // Group by category
  const grouped: Record<string, typeof models> = {};
  for (const model of models) {
    if (!grouped[model.category]) {
      grouped[model.category] = [];
    }
    grouped[model.category].push(model);
  }

  return NextResponse.json({
    models,
    grouped,
    providers: {
      nvidia: {
        name: "NVIDIA NIM",
        requiresKey: true,
        keyUrl: "https://build.nvidia.com/",
        keyName: "NVIDIA_API_KEY",
      },
      "z-ai": {
        name: "Z.ai",
        requiresKey: false,
        keyUrl: "",
        keyName: "ZAI_API_KEY",
      },
      minimax: {
        name: "MiniMax AI",
        requiresKey: true,
        keyUrl: "https://platform.minimaxi.com/",
        keyName: "MINIMAX_API_KEY",
      },
    },
  });
}
