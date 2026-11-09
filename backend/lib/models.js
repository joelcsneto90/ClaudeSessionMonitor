import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CATALOG_DIR = path.join(os.homedir(), '.claude', 'cache', 'model-catalog');

let cache = null; // { stamp, windows }

/**
 * Tamanho da janela de contexto por modelo, do catalogo que o Claude Code cacheia:
 * `models[].runtime.max_input_tokens` (1M no Opus 5.5, 200k no Haiku 4.5).
 * Sem isto o % de contexto nao teria denominador.
 */
export function modelWindows(dir = CATALOG_DIR) {
  let newest = null;
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.json')) continue;
      const file = path.join(dir, entry);
      const { mtimeMs } = fs.statSync(file);
      if (!newest || mtimeMs > newest.mtimeMs) newest = { file, mtimeMs };
    }
  } catch {
    return new Map();
  }
  if (!newest) return new Map();
  if (cache?.stamp === newest.mtimeMs) return cache.windows;

  const windows = new Map();
  try {
    const catalog = JSON.parse(fs.readFileSync(newest.file, 'utf8'));
    for (const model of catalog.catalog?.config?.models ?? []) {
      const limit = model.runtime?.max_input_tokens;
      if (model.id && Number.isFinite(limit)) windows.set(model.id, limit);
    }
  } catch {
    return cache?.windows ?? new Map();
  }

  cache = { stamp: newest.mtimeMs, windows };
  return windows;
}
