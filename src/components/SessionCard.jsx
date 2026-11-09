import { useState } from 'react';
import { ago, STATUS_LABEL } from '../format.js';

export function SessionCard({ session, groups, onMover }) {
  const [copied, setCopied] = useState(null);
  const [focusing, setFocusing] = useState(null);
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

      <div className="card-grupo">
        <select
          value=""
          aria-label="Mover para um grupo"
          onChange={(evento) => {
            const destino = evento.target.value;
            evento.target.value = '';
            if (destino) onMover(session, destino);
          }}
        >
          <option value="">adicionar a grupo…</option>
          {groups
            .filter((grupo) => grupo.id !== session.groupId)
            .map((grupo) => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.name}
              </option>
            ))}
          {session.cwd && <option value="__novo__">novo grupo com esta pasta</option>}
        </select>
      </div>

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

        <button type="button" className="card-resume" onClick={copy} title={command}>
          {copied ?? 'copiar retomada'}
        </button>
      </footer>
    </article>
  );
}
