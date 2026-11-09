import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cache mantido pela statusline do usuario. O painel so le: nao toca em credencial.
export const ACCOUNT_FILE = path.join(os.homedir(), '.claude', '.statusline-account.json');

export function readAccount(file = ACCOUNT_FILE) {
  try {
    const { email, plan } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!email && !plan) return null;
    return { email: email ?? null, plan: plan ?? null };
  } catch {
    return null;
  }
}
