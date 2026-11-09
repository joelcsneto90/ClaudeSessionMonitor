import os from 'node:os';
import { normalizePath, matchesPrefix, FALLBACK_GROUP_ID } from './groups.js';

// Abaixo disso o prefixo e generico demais para virar grupo (raiz de disco, home...).
const MIN_SEGMENTS = 3;

// Pasta com nome de UUID nunca da um bom nome de grupo (workspaces temporarios, por exemplo).
const UUID_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parentOf(cwd) {
  const normalized = normalizePath(cwd);
  const cut = normalized.lastIndexOf('/');
  return cut <= 0 ? '' : normalized.slice(0, cut);
}

function isUsefulPrefix(prefix) {
  if (!prefix) return false;
  if (prefix.split('/').filter(Boolean).length < MIN_SEGMENTS) return false;
  if (UUID_NAME.test(nameOf(prefix))) return false;
  return prefix !== normalizePath(os.homedir());
}

function nameOf(prefix) {
  return prefix.slice(prefix.lastIndexOf('/') + 1);
}

// O nome vai para a UI, entao sai do cwd cru: normalizePath baixa a caixa.
function displayName(cwd) {
  const parts = String(cwd).split(/[\\/]+/).filter(Boolean);
  return parts.at(-2) ?? '';
}

/**
 * Os diretorios das sessoes que cairam no grupo de fallback, com a contagem.
 * A sugestao por pasta-mae descarta caminho generico demais (raiz, home, pasta com nome
 * de UUID); esta lista nao descarta nada, para que todo diretorio sem grupo possa virar um.
 */
export function ungroupedPaths(sessions, fallbackId = FALLBACK_GROUP_ID) {
  const porCaminho = new Map();
  for (const session of sessions) {
    if (session.groupId !== fallbackId || !session.cwd) continue;
    const atual = porCaminho.get(session.cwd) ?? { cwd: session.cwd, sessionCount: 0, titles: [] };
    atual.sessionCount += 1;
    // O caminho de um workspace temporario nao diz nada: o titulo e o que identifica.
    if (session.title) atual.titles.push(session.title);
    porCaminho.set(session.cwd, atual);
  }
  return [...porCaminho.values()]
    .sort((a, b) => b.sessionCount - a.sessionCount || a.cwd.localeCompare(b.cwd))
    .map((entrada) => ({
      ...entrada,
      name: entrada.cwd.split(/[\\/]+/).filter(Boolean).at(-1) ?? entrada.cwd,
    }));
}

// Sugere um grupo por pasta-mae dos cwd das sessoes abertas, ignorando o que ja
// esta coberto por alguma regra existente. Nada e gravado aqui.
export function suggestGroups(sessions, groups = []) {
  const covered = groups
    .filter((group) => group.id !== FALLBACK_GROUP_ID)
    .flatMap((group) => group.rules ?? []);

  const byPrefix = new Map();
  for (const session of sessions) {
    if (covered.some((rule) => rule.type === 'session' && rule.value === session.sessionId)) continue;
    if (covered.some((rule) => rule.type === 'pathPrefix' && matchesPrefix(session.cwd, rule.value))) continue;

    const prefix = parentOf(session.cwd);
    if (!isUsefulPrefix(prefix)) continue;

    const current = byPrefix.get(prefix) ?? { pathPrefix: prefix, sessionCount: 0, sample: session.cwd };
    current.sessionCount += 1;
    byPrefix.set(prefix, current);
  }

  return [...byPrefix.values()]
    .sort((a, b) => b.sessionCount - a.sessionCount || a.pathPrefix.localeCompare(b.pathPrefix))
    .map((suggestion) => ({
      name: displayName(suggestion.sample),
      pathPrefix: suggestion.pathPrefix,
      sessionCount: suggestion.sessionCount,
    }));
}
