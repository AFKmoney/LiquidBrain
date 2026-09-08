// Node ESM requires explicit file extensions, while the Next.js / bundler
// resolution used by the app allows `./backend`. This hook lets `node --test`
// run the same source files without rewriting app imports to `*.ts`.
//
// Used by: npm test  (see package.json "test" script)
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TS_LIKE = /\.[cm]?[jt]sx?$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.') || TS_LIKE.test(specifier)) {
      return nextResolve(specifier, context);
    }

    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const parentURL = context.parentURL;
      if (parentURL?.startsWith('file:')) {
        const dir = fileURLToPath(new URL('.', parentURL));
        for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
          if (existsSync(new URL(candidate, `file://${dir}`))) {
            return nextResolve(candidate, context);
          }
        }
      }
      throw error;
    }
  },
});
