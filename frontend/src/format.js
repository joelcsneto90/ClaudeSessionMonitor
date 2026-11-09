export const STATUS_LABEL = {
  busy: 'rodando',
  shell: 'shell',
  waiting: 'aguardando',
  idle: 'parada',
};

function humanize(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, '0')}`;
  return `${Math.floor(hours / 24)}d`;
}

export function ago(timestamp) {
  if (!timestamp) return '—';
  return humanize(Math.max(0, Math.round((Date.now() - timestamp) / 1000)));
}

// resets_at pode vir como ISO ou como epoch (em segundos ou milissegundos).
export function untilReset(value) {
  if (!value) return null;
  const at = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(at)) return null;
  const seconds = Math.round((at - Date.now()) / 1000);
  return seconds <= 0 ? 'agora' : humanize(seconds);
}

// Preto ou branco sobre a cor do grupo, conforme a luminancia dela.
export function readableOn(hex) {
  const raw = String(hex).replace('#', '');
  const value = raw.length === 3 ? raw.replace(/./g, (char) => char + char) : raw;
  // Cor fora de hex (nome CSS, rgb(), lixo): escuro é a aposta segura.
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#16181d';
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#16181d' : '#ffffff';
}
