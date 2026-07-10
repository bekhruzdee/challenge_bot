// Vercel serverless entry point.
// Importing from TypeScript source (not dist/) so @vercel/node's ncc compiler
// bundles express, NestJS, grammy, and all other deps into a single Lambda
// file — avoiding pnpm symlink resolution failures at Lambda runtime.
export { default } from '../src/lambda';
