export const FALLBACK_GROUP_ID = 'others';

// Normaliza para comparacao: separador unico, sem barra final, minusculas.
export function normalizePath(value) {
  return String(value ?? '')
    .replace(/[\\/]+/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

// Casa apenas em fronteira de pasta: /x/repo nao casa /x/repositorio.
export function matchesPrefix(cwd, prefix) {
  const target = normalizePath(cwd);
  const base = normalizePath(prefix);
  if (!base || !target) return false;
  return target === base || target.startsWith(base + '/');
}

// Regra de sessao tem prioridade sobre prefixo de diretorio, em qualquer grupo.
export function groupIdFor(session, groups) {
  for (const group of groups) {
    for (const rule of group.rules) {
      if (rule.type === 'session' && rule.value === session.sessionId) return group.id;
    }
  }
  for (const group of groups) {
    for (const rule of group.rules) {
      if (rule.type === 'pathPrefix' && matchesPrefix(session.cwd, rule.value)) return group.id;
    }
  }
  return FALLBACK_GROUP_ID;
}
