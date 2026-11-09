import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// O transcript passa de 7 MB e isto roda a cada refresh: le so o fim do arquivo.
const TAIL_BYTES = 256 * 1024;

// sessionId -> { file, size, info }. Sem isto, cada refresh reabriria todo transcript.
const cache = new Map();

function findTranscript(sessionId, projectsDir) {
  let dirs;
  try {
    dirs = fs.readdirSync(projectsDir);
  } catch {
    return null;
  }
  for (const dir of dirs) {
    const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function readTail(file, size) {
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const handle = fs.openSync(file, 'r');
  try {
    fs.readSync(handle, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(handle);
  }
  return buffer.toString('utf8').split('\n');
}

/**
 * Do fim do transcript tira as duas coisas que o arquivo de sessao nao tem:
 *  - aiTitle: o titulo que o Claude Code gera e que a UI do VS Code mostra;
 *  - tokens/model: o contexto ja consumido, para o % junto com lib/models.js.
 * Uma leitura so, porque as duas informacoes vivem no mesmo arquivo.
 */
export function readTranscriptInfo(sessionId, projectsDir = PROJECTS_DIR) {
  const cached = cache.get(sessionId);
  const file = cached?.file ?? findTranscript(sessionId, projectsDir);
  if (!file) return null;

  let size;
  try {
    ({ size } = fs.statSync(file));
  } catch {
    cache.delete(sessionId);
    return null;
  }
  if (cached && cached.size === size) return cached.info;

  const lines = readTail(file, size);
  const info = { aiTitle: null, tokens: null, model: null };

  for (let at = lines.length - 1; at >= 0 && (!info.aiTitle || !info.tokens); at--) {
    const line = lines[at];
    if (!line.startsWith('{')) continue; // a primeira linha do pedaco vem cortada
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (!info.aiTitle && entry.type === 'ai-title' && entry.aiTitle) {
      info.aiTitle = entry.aiTitle;
    }
    if (!info.tokens && entry.type === 'assistant' && entry.message?.usage) {
      const usage = entry.message.usage;
      const total =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      if (total > 0) {
        info.tokens = total;
        info.model = entry.message.model ?? null;
      }
    }
  }

  // O pedaco lido pode nao conter um dos dois: melhor o valor anterior que nada.
  const merged = {
    aiTitle: info.aiTitle ?? cached?.info?.aiTitle ?? null,
    tokens: info.tokens ?? cached?.info?.tokens ?? null,
    model: info.model ?? cached?.info?.model ?? null,
  };
  cache.set(sessionId, { file, size, info: merged });
  return merged;
}

/**
 * O `name` do arquivo de sessao so presta quando o usuario escolheu: com
 * `nameSource: "derived"` ele e um slug da pasta (netitcrm-b9), enquanto o transcript
 * guarda o titulo de verdade ("Roadmap de lux-vestiaire-orders").
 */
export function displayTitle(session, info) {
  if (session.nameSource !== 'derived') return session.name;
  return info?.aiTitle ?? session.name;
}

export function contextPercent(info, windows) {
  const limit = info?.model ? windows.get(info.model) : null;
  if (!info?.tokens || !limit) return null;
  return Math.min(100, (info.tokens / limit) * 100);
}
