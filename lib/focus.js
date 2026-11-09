import { spawn } from 'node:child_process';

/**
 * Traz para a frente o editor de uma sessao.
 *
 * Limite real: o VS Code nao expoe, de fora, foco de aba de terminal — varias sessoes
 * podem viver na mesma janela. O maximo alcancavel e a janela da pasta: `code <pasta>`
 * foca a janela que ja tem essa pasta aberta, em vez de abrir outra.
 *
 * O cwd nunca vem do cliente: e lido do arquivo da sessao viva pelo proprio servidor.
 */
export function focusEditor(session) {
  if (session.entrypoint !== 'claude-vscode') {
    return { ok: false, reason: `sem janela para focar (entrypoint "${session.entrypoint ?? 'cli'}")` };
  }
  if (!session.cwd) {
    return { ok: false, reason: 'sessão sem diretório' };
  }

  const [command, args] =
    process.platform === 'win32'
      ? [process.env.COMSPEC ?? 'cmd.exe', ['/c', 'code', session.cwd]]
      : ['code', [session.cwd]];

  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {}); // `code` fora do PATH: o botao apenas nao faz nada
  child.unref();

  return { ok: true, focused: session.cwd };
}
