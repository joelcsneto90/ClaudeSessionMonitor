import { ago, untilReset } from '../format.js';

function UsageBar({ label, window: limit }) {
  const pct = typeof limit?.used_percentage === 'number' ? limit.used_percentage : null;
  const reset = untilReset(limit?.resets_at);

  return (
    <div className="usage-window">
      <span className="usage">
        <span className="usage-label">{label}</span>
        <span className="track">
          <span className="track-fill" style={{ width: `${pct ?? 0}%` }} />
        </span>
        <span className="usage-pct">{pct === null ? '—' : `${Math.round(pct)}%`}</span>
      </span>
      <span className="usage-details">
        {reset && <span className="usage-reset">reseta em {reset} · </span>}
        <span
          className="usage-age"
          title="Horário em que a statusline enviou esta leitura, não de uma consulta ao servidor."
        >
          {limit
            ? `feed recebido há ${ago(limit.receivedAt)}`
            : 'sem leitura válida — aguardando a statusline'}
        </span>
      </span>
    </div>
  );
}

export function Footer({ usage, account }) {
  return (
    <footer className="app-footer">
      <div className="usage-group" aria-label="Limites de uso da conta via statusline">
        <UsageBar label="Conta · 5h" window={usage?.fiveHour} />
        <span className="sep">|</span>
        <UsageBar label="Conta · 7 dias" window={usage?.sevenDay} />
      </div>

      {account && (
        <div className="account">
          {account.email}
          {account.plan && <span className="account-plan">{account.plan}</span>}
        </div>
      )}
    </footer>
  );
}
