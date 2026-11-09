export const FALLBACK_GROUP_ID = 'others';

export const PALETTE = ['#1b4fd8', '#14161b', '#c9b68d', '#2e7d6b', '#8e44ad', '#c0562a'];

export function novoId(base) {
  const prefixo = String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `${prefixo || 'g'}-${crypto.randomUUID().slice(0, 8)}`;
}
