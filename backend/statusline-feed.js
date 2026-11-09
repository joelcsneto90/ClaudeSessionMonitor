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

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${sessionId}.json`),
      JSON.stringify({
        sessionId,
        ctxPct: payload.context_window?.used_percentage ?? null,
        fiveHour: payload.rate_limits?.five_hour ?? null,
        sevenDay: payload.rate_limits?.seven_day ?? null,
        model: payload.model?.display_name ?? null,
        effort: payload.effort?.level ?? null,
        cost: payload.cost ?? null,
        ts: Date.now(),
      })
    );
    return true;
  } catch {
    return false;
  }
}
