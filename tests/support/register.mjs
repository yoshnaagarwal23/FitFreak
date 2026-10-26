// Module-resolution hooks so plain `node --test` can load the app's TypeScript:
// maps the `@/` alias to src/ and adds the `.ts` extension Expo's bundler normally infers.
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve(import.meta.dirname, '../../src') + '/';

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) spec = pathToFileURL(SRC + spec.slice(2)).href;
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith('.') || spec.startsWith('file:')) return next(spec + '.ts', ctx);
      throw e;
    }
  },
  // The app's .ts files are ES modules; saying so skips Node's CommonJS-first guess and its warning.
  load(url, ctx, next) {
    const isAppTs = url.startsWith(pathToFileURL(SRC).href) && url.endsWith('.ts');
    return next(url, isAppTs ? { ...ctx, format: 'module-typescript' } : ctx);
  },
});
