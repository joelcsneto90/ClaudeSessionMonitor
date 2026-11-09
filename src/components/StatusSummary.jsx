// Ordem de leitura: o que exige atencao primeiro, o que esta parado por ultimo.
const ORDER = [
  { status: 'waiting', one: 'esperando você', many: 'esperando você' },
  { status: 'busy', one: 'rodando', many: 'rodando' },
  { status: 'shell', one: 'em shell', many: 'em shell' },
  { status: 'idle', one: 'parada', many: 'paradas' },
];

export function StatusSummary({ sessions }) {
  const counts = ORDER.map((entry) => ({
    ...entry,
    total: sessions.filter((session) => session.status === entry.status).length,
  })).filter((entry) => entry.total > 0);

  if (sessions.length === 0) {
    return <p className="status-summary">nenhuma sessão aberta</p>;
  }

  return (
    <p className="status-summary">
      {counts.map((entry) => (
        <span key={entry.status} className={`status-chip status-chip-${entry.status}`}>
          <i className={`dot dot-${entry.status}`} />
          {entry.total} {entry.total === 1 ? entry.one : entry.many}
        </span>
      ))}
      <span className="status-total">
        {sessions.length} no total
      </span>
    </p>
  );
}
