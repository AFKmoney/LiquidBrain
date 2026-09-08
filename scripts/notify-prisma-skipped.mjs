// `prisma generate` needs to download engine binaries. When that is not
// possible (offline CI, restricted networks) the install must still succeed:
// chat persistence is optional and src/lib/agi/history.ts degrades to an
// in-memory-less "ephemeral session" mode. This script only prints the notice.
console.warn(
  '[LiquidBrain] prisma generate skipped — run "npm run db:generate" and ' +
    '"npm run db:push" to enable chat persistence.'
);
