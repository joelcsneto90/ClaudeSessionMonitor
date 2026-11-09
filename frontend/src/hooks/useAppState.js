import { useEffect, useState } from 'react';

const EMPTY = { groups: [], sessions: [], suggestions: [], ungrouped: [], usage: null, account: null };

// Mantem o ultimo estado bom na tela enquanto o fetch corre, para a lista nao piscar.
export function useAppState(intervalMs) {
  const [state, setState] = useState(EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return; // sem isto, uma resposta lenta pode chegar depois e vencer a nova
      inFlight = true;
      try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setState(data);
        setError(null);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      } finally {
        inFlight = false;
      }
    };

    // Aba em segundo plano sofre throttling do navegador (ate ~1 tick/min), justo quando
    // o contador no titulo e o unico alerta. Atualiza assim que ela volta.
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') tick();
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener('focus', refreshOnReturn);
    };
  }, [intervalMs]);

  return { ...state, error };
}
