import { useRef } from 'react';
import { SessionCard } from './SessionCard.jsx';
import { readableOn } from '../format.js';

const VISIBLE = 3;

export function Panel({ group, sessions, groups, onMover }) {
  const dialog = useRef(null);
  const visible = sessions.slice(0, VISIBLE);
  const hidden = sessions.length - visible.length;
  const ink = readableOn(group.color);

  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();
  // Clique no fundo (fora do conteudo) fecha, como manda o comportamento de dialog.
  const closeOnBackdrop = (event) => {
    if (event.target === dialog.current) close();
  };

  return (
    <section className="panel" style={{ '--group': group.color }}>
      <header className="panel-header" style={{ color: ink }}>
        <button type="button" className="panel-open" onClick={open} title={`Abrir ${group.name}`}>
          {group.name}
        </button>
        <span className="panel-count">{sessions.length}</span>
      </header>

      <div className="panel-body">
        {sessions.length === 0 ? (
          <p className="panel-empty">nenhuma sessão</p>
        ) : (
          visible.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              groups={groups}
              onMover={onMover}
            />
          ))
        )}

        {hidden > 0 && (
          <button type="button" className="panel-more" onClick={open}>
            +{hidden} {hidden === 1 ? 'sessão' : 'sessões'} · ver todas
          </button>
        )}
      </div>

      <dialog ref={dialog} className="group-dialog" onClick={closeOnBackdrop}>
        <header className="dialog-header" style={{ background: group.color, color: ink }}>
          <span>
            {group.name} · {sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}
          </span>
          <button type="button" className="dialog-close" onClick={close} style={{ color: ink }}>
            fechar
          </button>
        </header>
        <div className="dialog-body">
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              groups={groups}
              onMover={onMover}
            />
          ))}
        </div>
      </dialog>
    </section>
  );
}
