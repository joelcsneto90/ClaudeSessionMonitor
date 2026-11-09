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

// Rate limit e por conta, nao por sessao: vale o feed escrito mais recentemente.
export function latestUsage(feed) {
  let latest = null;
  for (const entry of feed.values()) {
    if (!entry.fiveHour && !entry.sevenDay) continue;
    if (!latest || entry.ts > latest.ts) latest = entry;
  }
  return latest && { fiveHour: latest.fiveHour, sevenDay: latest.sevenDay, ts: latest.ts };
}
