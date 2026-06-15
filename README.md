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
Every request flows through the complete AGI cognitive pipeline:
1. **PERCEIVE** — Sensory input is embedded into the complex plane
2. **THINK** — Fractal neural cycles activate concept nodes
3. **RECALL** — Memory retrieval via LSH over complex embeddings
4. **STATE** — Coherence and meta-cognition assessment
5. **GENERATE** — LLM produces a context-enriched response
6. **REFLECT** — Post-generation self-evaluation and rewiring

### Multi-Model Support
Route requests to different AI providers through a unified cognitive layer:

| Provider | Models | Capabilities |
|----------|--------|-------------|
| **Z-AI** | GLM-5.1, GLM-5.1-Flash | Chat, Reasoning |
| **NVIDIA NIM** | Nemotron Ultra, Llama 3.1, Mixtral | Chat, Vision, Embeddings |
| **MiniMax** | MiniMax-Text-01, abab6.5s | Chat, TTS, Video |

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
- 👁️ **Vision** — Image understanding and analysis
- 🎨 **Image Generation** — AI-powered image creation
- 🔊 **Text-to-Speech** — Natural voice synthesis
- 🛡️ **Safety** — Content moderation and safety checks
- 🧠 **Think** — Trigger fractal neural cycles manually
- 🪞 **Reflect** — Meta-cognitive self-assessment
- 🏋️ **Train** — Online learning with custom text

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│                   Frontend                    │
│  Next.js 16 + React 19 + Tailwind CSS 4      │
│  FractalSNN · MemoryMap · ModelSelector       │
│  ControlPanel · ReflectionBar · Sequencer     │
└──────────────┬───────────────────────────────┘
               │ /api/agi/*
┌──────────────▼───────────────────────────────┐
│              Next.js API Routes               │
│  chat · vision · image · tts · safety         │
│  perceive · think · reflect · state · memory  │
│  models · train                               │
└──────────────┬───────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌──────▼──────┐
│  FractalBrain │ │  AI Models  │
│  (Port 8080)  │ │  (Multi-    │
│  Rust Backend │ │   Provider) │
└──────────────┘ └─────────────┘
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Zustand, Framer Motion, Recharts
- **Backend**: Next.js API Routes (App Router), Z-AI Web Dev SDK
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
│   │   ├── chat/route.ts       # Chat with cognitive pipeline
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
│   ├── layout.tsx
│   └── page.tsx                # Main AGI dashboard
├── components/
│   ├── agi/
│   │   ├── FractalSNN.tsx      # Mandelbrot neural visualization
│   │   ├── MemoryMap.tsx       # Interactive concept cloud
│   │   ├── ModelSelector.tsx   # Multi-model picker
│   │   ├── ControlPanel.tsx    # Chat & control interface
│   │   ├── ReflectionBar.tsx   # Coherence & reflection display
│   │   └── Sequencer.tsx       # Pipeline step sequencer
│   └── ui/                     # shadcn/ui components
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
└── lib/
    ├── agi/
    │   ├── api.ts              # API client & types
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
- Node.js 18+ or Bun
- FractalBrain backend running on `http://127.0.0.1:8080` (optional — the dashboard works in LLM-only mode without it)

### Installation

```bash
# Clone the repository
git clone https://github.com/Liquid2HQ/LiquidBrain.git
cd LiquidBrain

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

### Environment Variables

Create a `.env` file in the project root:

```env
# FractalBrain Backend (optional)
FRACTALBRAIN_URL=http://127.0.0.1:8080

# AI Provider API Keys (optional — enter via the UI)
NVIDIA_API_KEY=
MINIMAX_API_KEY=
ZAI_API_KEY=
```

---

## 🧪 Usage

1. **Chat**: Type a message to interact with LiquidBrain. The cognitive pipeline enriches every response with fractal context.
2. **Switch Models**: Click the model badge (e.g., "GLM-5.1") to open the model selector and choose from NVIDIA, MiniMax, or Z-AI models.
3. **Think**: Trigger manual think cycles to process the current neural state.
4. **Reflect**: Run a self-reflection to assess coherence and potentially rewire connections.
5. **Train**: Feed custom text into the fractal network for online learning.
6. **Fractal View**: Toggle the Mandelbrot visualization to see the neural substrate in action.

---

## 📄 License

MIT
