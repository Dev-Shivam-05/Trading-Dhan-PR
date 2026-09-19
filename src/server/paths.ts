/**
 * Where the server may write. Locally that is `.cache/` under the project (gitignored). On a
 * serverless host (P17: Vercel) the deployment directory is read-only and only `/tmp` is writable,
 * so the host sets CACHE_DIR. Every module that persists anything resolves its path through here.
 */

import path from 'node:path';

export const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.resolve(process.cwd(), '.cache');
