// Vercel serverless entry point.
// All NestJS compilation (emitDecoratorMetadata, experimentalDecorators) is
// handled by `nest build` (tsc). This wrapper just re-exports the handler
// so Vercel's function discovery works without re-compiling TypeScript.
module.exports = require('../dist/src/lambda').default;
