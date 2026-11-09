import { useEffect, useState } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { Panel } from './components/Panel.jsx';
import { StatusSummary } from './components/StatusSummary.jsx';
import { Footer } from './components/Footer.jsx';
import { GroupsDialog } from './components/GroupsDialog.jsx';
import { PALETTE, novoId } from './groups.js';

const REFRESH_MS = 2000;

export default function App() {
  const { groups, sessions, usage, account, error } = useAppState(REFRESH_MS);
  const [editando, setEditando] = useState(false);
  const waiting = sessions.filter((session) => session.status === 'waiting').length;

  const salvarGrupos = async (novos) => {
    const response = await fetch('/api/groups', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(novos),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
  };

  // Mover uma sessao e uma regra do tipo "session" no grupo de destino; ela vence
  // qualquer regra de pasta, entao basta garantir que exista em um grupo so.
  const moverSessao = (session, destino) => {
    const semEsta = groups.map((grupo) => ({
      ...grupo,
      rules: grupo.rules.filter(
        (regra) => !(regra.type === 'session' && regra.value === session.sessionId)
      ),
    }));

    if (destino === '__novo__') {
      const nome = session.cwd.split(/[\\/]+/).filter(Boolean).at(-1) ?? session.title;
      const novo = {
        id: novoId(nome),
        name: nome,
        color: PALETTE[groups.length % PALETTE.length],
        rules: [{ id: novoId('r'), type: 'pathPrefix', value: session.cwd }],
      };
      const fim = semEsta.filter((grupo) => !grupo.removable);
      return salvarGrupos([...semEsta.filter((grupo) => grupo.removable), novo, ...fim]);
    }

    return salvarGrupos(
      semEsta.map((grupo) =>
        grupo.id === destino
          ? {
              ...grupo,
              rules: [...grupo.rules, { id: novoId('r'), type: 'session', value: session.sessionId }],
            }
          : grupo
      )
    );
  };

  // O contador no titulo deixa a aba fixada servir de alerta.
  useEffect(() => {
    document.title = `${waiting ? `(${waiting}) ` : ''}Claude sessions`;
  }, [waiting]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-topo">
          <h1>Claude sessions</h1>
          <button type="button" className="botao-grupos" onClick={() => setEditando(true)}>
            Grupos
          </button>
        </div>
        <StatusSummary sessions={sessions} />
      </header>

      {editando && (
        <GroupsDialog groups={groups} onSave={salvarGrupos} onClose={() => setEditando(false)} />
      )}

      {error && (
        <p className="banner">
          Sem resposta do servidor ({error}).
          {groups.length > 0 && ' Mostrando o último estado conhecido.'}
        </p>
      )}

      <div className="panels">
        {groups.map((group) => (
          <Panel
            key={group.id}
            group={group}
            sessions={sessions.filter((session) => session.groupId === group.id)}
            groups={groups}
            onMover={moverSessao}
          />
        ))}
      </div>

      <Footer usage={usage} account={account} />
    </div>
  );
}
