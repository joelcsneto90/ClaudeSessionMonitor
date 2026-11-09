import fs from 'node:fs';
import path from 'node:path';
import { FEED_DIR } from '../statusline-feed.js';

export function readFeed(dir = FEED_DIR) {
  const bySession = new Map();

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return bySession; // sem feed ainda: a statusline nao foi ligada
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
      if (data.sessionId) bySession.set(data.sessionId, data);
    } catch {
      continue;
    }
  }
  return bySession;
}

// Cada janela e da conta e pode vir de uma sessao diferente.
export function latestUsage(feed, now = Date.now()) {
  const usage = { fiveHour: null, sevenDay: null, ts: 0 };
  for (const entry of feed.values()) {
    for (const key of ['fiveHour', 'sevenDay']) {
      const limit = entry[key];
      if (!limit) continue;
      const resetAt = typeof limit.resets_at === 'number'
        ? (limit.resets_at < 1e12 ? limit.resets_at * 1000 : limit.resets_at)
        : Date.parse(limit.resets_at);
      if (!Number.isFinite(resetAt) || resetAt <= now) continue;

      const receivedAt = limit.receivedAt ?? entry.ts;
      if (!usage[key] || receivedAt > usage[key].receivedAt) {
        usage[key] = { ...limit, receivedAt };
        usage.ts = Math.max(usage.ts, receivedAt);
      }
    }
  }
  return usage.fiveHour || usage.sevenDay ? usage : null;
}
