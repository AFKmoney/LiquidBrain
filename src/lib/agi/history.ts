import type { StoredChatMessage } from "./types";

// ─── Chat persistence (SQLite via Prisma) ───────────────────────
// Every helper degrades gracefully: when the database is missing or
// the Prisma client has not been generated yet, the dashboard still
// works — it just loses cross-reload persistence. That keeps the
// documented "LLM-only mode" honest instead of 500-ing.
//
// The client is typed structurally (not via Prisma's generated types)
// so this module still compiles before `prisma generate` has run.

type Db = {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
  chatTurn: {
    findMany(args: {
      orderBy: unknown;
      take: number;
    }): Promise<
      Array<{
        id: number;
        role: string;
        content: string;
        model: string | null;
        coherence: number | null;
        createdAt: Date;
      }>
    >;
    create(args: {
      data: {
        role: string;
        content: string;
        model: string | null;
        coherence: number | null;
      };
    }): Promise<unknown>;
    deleteMany(args: Record<string, never>): Promise<{ count: number }>;
  };
};

let cached: Db | null | undefined;

async function getDb(): Promise<Db | null> {
  if (cached !== undefined) return cached;
  try {
    // Lazy import so a missing / misconfigured Prisma client never takes
    // down the whole API route module at load time.
    const mod = (await import("@/lib/db")) as { db?: unknown };
    const candidate = mod.db as Db | undefined;
    if (!candidate) throw new Error("Prisma client not initialised");
    await candidate.$queryRaw`SELECT 1`;
    cached = candidate;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when chat turns are actually being persisted to SQLite. */
export async function isPersistenceAvailable(): Promise<boolean> {
  return (await getDb()) !== null;
}

/** Most recent turns, oldest first. */
export async function loadHistory(limit = 20): Promise<StoredChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  const take = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), 100);
  try {
    const rows = await db.chatTurn.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
    return rows
      .reverse()
      .map((r) => ({
        id: r.id,
        role: r.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: r.content,
        timestamp: r.createdAt.getTime(),
        model: r.model,
        coherence: r.coherence,
      }));
  } catch {
    return [];
  }
}

export async function appendTurn(turn: {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  coherence?: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.chatTurn.create({
      data: {
        role: turn.role,
        content: turn.content,
        model: turn.model ?? null,
        coherence: turn.coherence ?? null,
      },
    });
  } catch {
    // persistence is best-effort
  }
}

export async function clearHistory(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const { count } = await db.chatTurn.deleteMany({});
    return count;
  } catch {
    return 0;
  }
}
