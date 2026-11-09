import { useId, useRef, useState } from 'react';
import { ago, STATUS_LABEL } from '../format.js';

export function SessionCard({ session, groups, onMover }) {
  const [copied, setCopied] = useState(null);
  const [focusing, setFocusing] = useState(null);
  const [choosingGroup, setChoosingGroup] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState(null);
  const actions = useRef(null);
  const actionsTitle = useId();
  const waiting = session.status === 'waiting';
  const command = `claude --resume ${session.sessionId}`;
  const inEditor = session.entrypoint === 'claude-vscode';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied('copiado');
    } catch {
      setCopied('copie do título'); // sem clipboard fora de contexto seguro
    }
    setTimeout(() => setCopied(null), 1600);
  };

  const focus = async () => {
    setFocusing('abrindo…');
    try {
      const response = await fetch(`/api/sessions/${session.sessionId}/focus`, { method: 'POST' });
      const body = await response.json();
      setFocusing(response.ok ? null : body.reason);
    } catch (failure) {
      setFocusing(failure.message);
    }
    setTimeout(() => setFocusing(null), 2000);
  };

  const openActions = () => {
    setChoosingGroup(false);
    setMoveError(null);
    actions.current.showModal();
  };

  const move = async (destination) => {
    setMoving(true);
    setMoveError(null);
    try {
      await onMover(session, destination);
      actions.current?.close();
    } catch (failure) {
      setMoveError(failure.message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <article className={waiting ? 'card card-waiting' : 'card'}>
      <div className="card-top">
        <span className="card-name" title={session.title ?? session.name}>
          {session.title ?? session.name}
        </span>
        <span className={`badge badge-${session.status}`}>
          {STATUS_LABEL[session.status] ?? session.status}
        </span>
      </div>

      {session.cwd && (
        <p className="card-cwd" title={session.cwd}>
          {session.cwd}
        </p>
      )}

      <div
        className="card-ctx"
        title={
          session.ctxTokens
            ? `${session.ctxTokens.toLocaleString('pt-BR')} tokens${session.model ? ` · ${session.model}` : ''}`
            : 'sem dados de contexto'
        }
      >
        <span className="card-ctx-label">Contexto</span>
        <span className="track">
          <span className="track-fill" style={{ width: `${session.ctxPct ?? 0}%` }} />
        </span>
        <span className="card-ctx-pct">
          {typeof session.ctxPct === 'number' ? `${Math.round(session.ctxPct)}%` : '—'}
        </span>
      </div>

      <dl className="card-meta">
        <div>
          <dt>Neste status</dt>
          <dd>{session.statusSince ? `há ${ago(session.statusSince)}` : '—'}</dd>
        </div>
        <div>
          <dt>Aberta</dt>
          <dd>{session.startedAt ? `há ${ago(session.startedAt)}` : '—'}</dd>
        </div>
      </dl>

      <footer className="card-footer">
        {inEditor ? (
          <button
            type="button"
            className="card-entrypoint card-entrypoint-action"
            onClick={focus}
            title={`Trazer para a frente a janela do VS Code em ${session.cwd}`}
          >
            {focusing ?? session.entrypoint}
          </button>
        ) : (
          <span className="card-entrypoint">{session.entrypoint ?? '—'}</span>
        )}

        <button type="button" className="card-actions" onClick={openActions} aria-haspopup="dialog">
          Ações
        </button>
      </footer>

      <dialog
        ref={actions}
        className="group-dialog session-actions"
        aria-labelledby={actionsTitle}
        onClick={(event) => {
          if (event.target === actions.current) actions.current.close();
        }}
      >
        <header className="dialog-header">
          <span id={actionsTitle}>{choosingGroup ? 'Adicionar ao grupo' : 'Ações'}</span>
          <button type="button" className="dialog-close" onClick={() => actions.current.close()}>
            fechar
          </button>
        </header>
        <div className="session-actions-body">
          <p className="session-actions-title">{session.title ?? session.name}</p>
          {choosingGroup ? (
            <>
              {groups
                .filter((grupo) => grupo.id !== session.groupId)
                .map((grupo) => (
                  <button
                    key={grupo.id}
                    type="button"
                    disabled={moving}
                    onClick={() => move(grupo.id)}
                  >
                    {grupo.name}
                  </button>
                ))}
              {session.cwd && (
                <button type="button" disabled={moving} onClick={() => move('__novo__')}>
                  novo grupo com esta pasta
                </button>
              )}
              {moveError && <p role="alert">{moveError}</p>}
              <button type="button" disabled={moving} onClick={() => setChoosingGroup(false)}>
                voltar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={copy} title={command}>
                {copied ?? 'copiar retomada'}
              </button>
              <button type="button" onClick={() => setChoosingGroup(true)}>
                adicionar ao grupo
              </button>
              {copied === 'copie do título' && <code>{command}</code>}
            </>
          )}
        </div>
      </dialog>
    </article>
  );
}
