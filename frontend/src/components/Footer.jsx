import { ago, untilReset } from '../format.js';

function UsageBar({ label, window: limit }) {
  const pct = typeof limit?.used_percentage === 'number' ? limit.used_percentage : null;
  const reset = untilReset(limit?.resets_at);

  return (
    <>
      <span className="usage">
        <span className="usage-label">{label}</span>
        <span className="track">
          <span className="track-fill" style={{ width: `${pct ?? 0}%` }} />
        </span>
        <span className="usage-pct">{pct === null ? '—' : `${Math.round(pct)}%`}</span>
      </span>
      {reset && (
        <>
          <span className="sep">|</span>
          <span className="usage-reset">reseta em {reset}</span>
        </>
      )}
    </>
  );
}

export function Footer({ usage, account }) {
  return (
    <footer className="app-footer">
      <div className="usage-group">
        <UsageBar label="Sessão 5h" window={usage?.fiveHour} />
        <span className="sep">|</span>
        <UsageBar label="Semana 7d" window={usage?.sevenDay} />
        <span className="sep">|</span>
        <span className="usage-age">
          {usage
            ? `atualizado há ${ago(usage.ts)}`
            : 'sem dados — a statusline ainda não alimenta o feed'}
        </span>
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
