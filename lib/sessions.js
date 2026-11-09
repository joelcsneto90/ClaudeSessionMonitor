import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');

// Ordem de exibicao: ativos, depois os que aguardam input, idle por ultimo.
const BUCKET = { busy: 0, shell: 0, waiting: 1, idle: 2 };

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // existe, mas sem permissao para sinalizar
  }
}

export function readSessions(dir = SESSIONS_DIR) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const sessions = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
    } catch {
      continue; // a sessao estava reescrevendo o arquivo neste instante
    }

    if (!Number.isInteger(raw.pid) || raw.pid <= 0 || !isAlive(raw.pid)) continue;

    sessions.push({
      pid: raw.pid,
      sessionId: raw.sessionId,
      name: raw.name || raw.sessionId,
      nameSource: raw.nameSource || null,
      cwd: raw.cwd || '',
      status: raw.status || 'idle',
      waitingFor: raw.waitingFor || null,
      entrypoint: raw.entrypoint || null,
      version: raw.version || null,
      startedAt: raw.startedAt || null,
      statusSince: raw.statusUpdatedAt || raw.updatedAt || raw.startedAt || 0,
    });
  }
  return sessions;
}

export function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    // Status que o Claude Code venha a adicionar vai para o fim, nao para o topo.
    const bucketA = BUCKET[a.status] ?? 2;
    const bucketB = BUCKET[b.status] ?? 2;
    if (bucketA !== bucketB) return bucketA - bucketB;
    // waiting: quem esta parado ha mais tempo primeiro. Demais: mais recente primeiro.
    return bucketA === 1 ? a.statusSince - b.statusSince : b.statusSince - a.statusSince;
  });
}
