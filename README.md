# 🧠 LIQUID2 — Fractal AGI Engine

**Real-time AGI dashboard for the LiquidBrain Fractal Engine.**  
Perception → Cognition → Memory → Action → Reflection.

---

## 🖼️ Screenshots

### Desktop Dashboard
![LIQUID2 Desktop Dashboard](public/screenshots/desktop-dashboard.png)

### Fractal Visualization
The Mandelbrot set comes alive as a neural graph — each fractal node represents a cognitive unit that activates, connects, and rewires in real-time.

![Fractal View](public/screenshots/fractal-view.png)

### Model Selector
Switch between AI models from NVIDIA NIM, MiniMax, Z-AI, and more. Each model passes through the FractalBrain cognitive pipeline before generating responses.

![Model Selector](public/screenshots/model-selector.png)

### Mobile Responsive
The dashboard adapts seamlessly to mobile and tablet viewports.

![Mobile View](public/screenshots/mobile-dashboard.png)

### Tablet View
![Tablet View](public/screenshots/tablet-view.png)

---

## 🚀 Features

### Fractal Cognition Pipeline
`POST /api/agi/chat` runs the pipeline in this order (see `src/lib/agi/pipeline.ts`):
1. **PERCEIVE** — the message is embedded into the complex plane by the engine
2. **RECALL** — salient concepts are retrieved and rendered into the prompt
3. **STATE** — coherence + last insight are read from the meta-cognition layer
4. **GENERATE** — the selected LLM answers, with the last 10 stored turns replayed
5. **PERSIST** — both turns are written to SQLite when it is configured
6. **THINK** — 3 background cycles are queued (fire-and-forget, never blocks the reply)

**REFLECT** (self-evaluation + rewiring) stays an explicit user action, in the sidebar
or the reflection bar.

Steps 1–3 and 6 are no-ops when `FRACTALBRAIN_URL` is unreachable: the LLM still answers.

### Multi-Model Support
Route requests to different AI providers through a unified cognitive layer:

| Provider | Models | Capabilities |
|----------|--------|-------------|
| **Z-AI** | GLM-5.1 (default) | Chat, reasoning, coding, agentic — needs `.z-ai-config` or `ZAI_API_KEY`/`ZAI_BASE_URL` |
| **NVIDIA NIM** | 34 entries: Nemotron Ultra/Super/Nano, DeepSeek, Kimi, Qwen, Llama 3.3/4, MiniMax M3/M2.7, FLUX.1, SD 3.5, Cosmos3, Magpie TTS, Llama Guard… | Chat, vision, image generation, TTS, safety |
| **MiniMax** | direct `api.minimax.chat` client (no registry model uses it yet) | Chat |

The registry (`src/lib/models/registry.ts`) is the single source of truth — `GET /api/agi/models`
exposes it, and `src/lib/models/registry.test.ts` asserts that ids, categories and key names stay coherent.

### Real-Time Fractal Visualization
- Mandelbrot set rendered as the neural substrate
- Active nodes pulse and connect in real-time
- Memory concepts positioned in the complex plane
- Coherence monitoring via visual feedback

### Memory Map
- Interactive concept cloud visualization
- Concept positions derived from fractal embeddings
- Salience-based size and color coding
- Hover to inspect individual memory traces

### Capabilities
- 💬 **Chat** — Conversational AI with fractal context enrichment
- 👁️ **Vision** — Image understanding and analysis (URL-based)
- 🎨 **Image Generation** — AI-powered image creation
- 🔊 **Text-to-Speech** — Natural voice synthesis
- 🛡️ **Safety** — Content moderation and safety checks
- 🧠 **Think** — Trigger fractal neural cycles manually
- 🪞 **Reflect** — Meta-cognitive self-assessment
- 🏋️ **Train** — Online learning with custom text (Brain Console)
- 🎞️ **Video** — model selection is wired, generation is still a stub in the UI

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────┐
│ Frontend                                   │
│ Next.js 16 + React 19 + Tailwind CSS 4     │
│ FractalSNN · MemoryMap · ModelSelector     │
│ ControlPanel · ReflectionBar · Sequencer   │
└────────────────────────────────────────────┘
                      │  /api/agi/*
┌────────────────────────────────────────────┐
│ Next.js API Routes                         │
│ chat · history · vision · image · tts      │
│ safety · perceive · think · reflect        │
│ state · memory · models · train            │
└────────────────────────────────────────────┘
                      │
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ FractalBrain     │ │ SQLite + Prisma  │ │ AI providers     │
│ (optional Rust)  │ │ ChatTurn history │ │ Z-AI SDK         │
│ FRACTALBRAIN_URL │ │ best-effort:     │ │ NVIDIA NIM       │
│ perceive · think │ │ no DB → chats    │ │ MiniMax          │
│ reflect · train  │ │ are ephemeral    │ │ per-model choice │
│ state · memory   │ │                  │ │ in the UI        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Zustand (Framer Motion / Recharts are installed but currently unused)
- **Backend**: Next.js API Routes (App Router), Z-AI Web Dev SDK, Prisma + SQLite (chat history)
- **AI Providers**: Z-AI, NVIDIA NIM, MiniMax
- **FractalBrain**: Rust-based cognitive engine (external service)
- **State Management**: Zustand for client state
- **Canvas Rendering**: HTML5 Canvas for Mandelbrot & Memory Map

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/agi/
│   │   ├── chat/route.ts       # Chat: perceive → recall → state → generate → persist
│   │   ├── history/route.ts    # GET/DELETE stored conversation (SQLite, optional)
│   │   ├── vision/route.ts     # Vision analysis
│   │   ├── image/route.ts      # Image generation
│   │   ├── tts/route.ts        # Text-to-speech
│   │   ├── safety/route.ts     # Content safety
│   │   ├── perceive/route.ts   # Perception proxy
│   │   ├── think/route.ts      # Think cycles proxy
│   │   ├── reflect/route.ts    # Reflection proxy
│   │   ├── state/route.ts      # Brain state proxy
│   │   ├── memory/route.ts     # Memory retrieval proxy
│   │   ├── models/route.ts     # Model registry
│   │   └── train/route.ts      # Online training
│   ├── globals.css
│   ├── layout.tsx              # Self-hosted Geist fonts (no Google Fonts at build time)
│   └── page.tsx                # Main AGI dashboard
├── components/
│   ├── agi/
│   │   ├── FractalSNN.tsx      # Mandelbrot neural visualization
│   │   ├── MemoryMap.tsx       # Interactive concept cloud
│   │   ├── ModelSelector.tsx   # Multi-model picker + provider keys
│   │   ├── ControlPanel.tsx    # Brain console: metrics, actions, training
│   │   ├── ReflectionBar.tsx   # Coherence / surprise / confidence / insight bar
│   │   └── Sequencer.tsx       # Perceive → think step sequencer
│   └── ui/                     # shadcn/ui primitives (vendored)
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
└── lib/
    ├── agi/
    │   ├── backend.ts          # FRACTALBRAIN_URL, timeouts, callBackend()
    │   ├── pipeline.ts         # perceive → recall → state context builder
    │   ├── history.ts          # Prisma chat persistence (graceful fallback)
    │   ├── types.ts            # Shared client/server types (backend contract)
    │   ├── api.ts              # Client API wrapper
    │   └── store.ts            # Zustand state store
    ├── models/
    │   ├── registry.ts         # Model definitions & categories
    │   └── providers.ts        # Provider-specific API clients
    ├── db.ts
    └── utils.ts
```


---

## ⚡ Getting Started

### Prerequisites
- Node.js 20+ (Bun also works — the repo ships `bun.lock`)
- FractalBrain backend running on `http://127.0.0.1:8080` (**optional** — without it the dashboard runs in LLM-only mode: chat works, Think/Reflect/Train/Memory report "offline")

### Installation

```bash
# Clone the repository
git clone https://github.com/AFKmoney/LiquidBrain.git
cd LiquidBrain

# Install dependencies (also prepares the Prisma client)
npm install        # or: bun install

# Start the development server
npm run dev        # or: bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

> **Lockfile note:** `bun.lock` is the lock of record. It predates the `geist` dependency added
> when fonts moved off Google Fonts, so run `bun install` (or `npm install`, which resolves from
> the registry) once to refresh it before relying on `bun ci`-style installs.

### Environment Variables

Copy `.env.example` to `.env` and adjust. `.env` is git-ignored; only `.env.example` is committed.

| Variable | Required | Purpose |
|--------|----------|---------|
| `FRACTALBRAIN_URL` | no | Base URL of the FractalBrain engine. Defaults to `http://127.0.0.1:8080`. Every `/api/agi/{state,memory,perceive,think,reflect,train}` proxy reads it. |
| `DATABASE_URL` | no | SQLite file for chat persistence, resolved **relative to `prisma/`** (`file:../db/custom.db` → `db/custom.db`). Leave unset (or skip `prisma generate`) and the app simply keeps chats in memory for the current page session. |
| `NVIDIA_API_KEY` | for NVIDIA models | NVIDIA NIM chat / image / TTS / safety. Can also be pasted in the in-app settings panel. |
| `MINIMAX_API_KEY` | for MiniMax models | MiniMax chat. Also settable in the UI. |
| `ZAI_API_KEY` + `ZAI_BASE_URL` | optional | Lets the Z-AI provider use an OpenAI-compatible endpoint instead of a config file. |

**Z-AI (the default `GLM-5.1` model)** is reached through `z-ai-web-dev-sdk`, which reads
`{ "baseUrl": "...", "apiKey": "..." }` from a `.z-ai-config` JSON file in the project root,
`~/.z-ai-config`, or `/etc/.z-ai-config`. Without that file (and without `ZAI_API_KEY`/`ZAI_BASE_URL`)
`POST /api/agi/chat` answers `502` with an explicit "Z-AI is not configured …" message — pick another
provider in the model selector instead. The file is git-ignored on purpose.

---

## 🧪 Usage

1. **Chat**: Type a message to interact with LiquidBrain. The cognitive pipeline enriches every response with fractal context, and the last 10 stored turns are replayed to the model so the conversation keeps its thread.
2. **Switch Models**: Click the model badge (e.g., "GLM-5.1") to open the model selector and choose from NVIDIA, MiniMax, or Z-AI models. The choice is remembered across reloads.
3. **Brain Console**: the "Brain Console" button (sidebar) opens live engine metrics plus Think / Reflect / Sync, the **Train** box and the **Sequencer** (perceive → think step programs).
4. **Reflect**: Run a self-reflection to assess coherence and potentially rewire connections — the bottom bar shows coherence, surprise, confidence, memory utilization and the latest insight.
5. **Fractal View**: Toggle the Mandelbrot visualization to see the neural substrate in action; concepts that fired during the last think cycle are highlighted.
6. **Esc** closes the top-most overlay (model selector → fractal view → console).

---

## 🗄️ Chat persistence

`/api/agi/chat` writes both turns into SQLite (`ChatTurn`), and `/api/agi/history` serves them back, so the transcript and the model's conversation context survive a reload.

```bash
npm run db:generate   # prisma generate
npm run db:push       # creates db/custom.db tables from prisma/schema.prisma
```

The whole layer is best-effort: if Prisma was not generated or the SQLite file is missing,
`GET /api/agi/history` returns `{ "messages": [], "persisted": false }` and the UI shows
"Ephemeral session" instead of failing.

---

## 🛠️ Development checks

```bash
npm run typecheck   # tsc --noEmit (the build also type-checks now)
npm run lint        # eslint
npm test            # node --test on src/**/*.test.ts (type-stripped, no extra toolchain)
npm run check       # all three
```

---

## 📄 License

MIT
