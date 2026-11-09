import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FEED_DIR = path.join(os.homedir(), '.claude-status', 'feed');

/**
 * Chamado pela statusline com o payload que ela recebe do Claude Code. Grava o que
 * o painel nao consegue ver de fora: % de contexto da sessao e as janelas de rate limit.
 *
 * Nunca lanca: statusline que quebra deixa o usuario sem barra de status.
 */
export function recordStatuslinePayload(payload, dir = FEED_DIR) {
  try {
    const sessionId = payload?.session_id ?? payload?.sessionId;
    if (!sessionId) return false;
    // A statusline tambem e chamada como hook, com um payload sem nenhum destes campos:
    // gravar ali apagaria um feed bom por cima.
    if (!payload.context_window && !payload.rate_limits) return false;

    const now = Date.now();
    const file = path.join(dir, `${sessionId}.json`);
    const incoming = {
      fiveHour: payload.rate_limits?.five_hour,
      sevenDay: payload.rate_limits?.seven_day,
    };
    let previous = null;
    if (!incoming.fiveHour || !incoming.sevenDay) {
      try {
        previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        // Uma chamada cancelada da statusline pode deixar o feed truncado.
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
    }

    const windows = {};
    for (const key of ['fiveHour', 'sevenDay']) {
      const limit = incoming[key] ?? previous?.[key];
      windows[key] = limit
        ? { ...limit, receivedAt: incoming[key] ? now : limit.receivedAt ?? previous.ts }
        : null;
    }

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({
        sessionId,
        ctxPct: payload.context_window?.used_percentage ?? null,
        ...windows,
        model: payload.model?.display_name ?? null,
        effort: payload.effort?.level ?? null,
        cost: payload.cost ?? null,
        ts: now,
      })
    );
    return true;
  } catch {
    return false;
  }
}
