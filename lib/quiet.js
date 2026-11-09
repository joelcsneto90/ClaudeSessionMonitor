// node:sqlite emite um ExperimentalWarning ao ser carregado. Este modulo precisa ser
// importado ANTES de node:sqlite para que o patch esteja no lugar quando o aviso sair.
const original = process.emitWarning;

process.emitWarning = (warning, ...rest) => {
  if (String(warning).includes('SQLite is an experimental feature')) return;
  return original.call(process, warning, ...rest);
};
