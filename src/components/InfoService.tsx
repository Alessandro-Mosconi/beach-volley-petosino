import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';

type ServiceStatus = 'ok' | 'error' | 'warning' | 'checking';

interface CheckResult {
  name: string;
  status: ServiceStatus;
  details: string;
}

export default function InfoService() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setChecks([
      { name: 'Connessione Supabase', status: 'checking', details: 'Verifica in corso...' },
      { name: 'Configurazione variabili ambiente', status: 'checking', details: 'Verifica in corso...' },
      { name: 'Stato rete browser', status: 'checking', details: 'Verifica in corso...' }
    ]);

    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const envOk = Boolean(envUrl && envKey);

    const networkOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    let supabaseStatus: CheckResult = {
      name: 'Connessione Supabase',
      status: 'error',
      details: 'Connessione non riuscita'
    };

    const startedAt = Date.now();
    const { error } = await supabase.from('squadra').select('id', { count: 'exact', head: true });
    const elapsedMs = Date.now() - startedAt;

    if (!error) {
      supabaseStatus = {
        name: 'Connessione Supabase',
        status: 'ok',
        details: `Connessione riuscita (${elapsedMs} ms)`
      };
    } else {
      supabaseStatus = {
        name: 'Connessione Supabase',
        status: 'error',
        details: `Errore: ${error.message}`
      };
    }

    const envStatus: CheckResult = {
      name: 'Configurazione variabili ambiente',
      status: envOk ? 'ok' : 'error',
      details: envOk
        ? 'VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY presenti'
        : 'Variabili Supabase mancanti'
    };

    const networkStatus: CheckResult = {
      name: 'Stato rete browser',
      status: networkOnline ? 'ok' : 'warning',
      details: networkOnline ? 'Browser online' : 'Browser offline'
    };

    setChecks([supabaseStatus, envStatus, networkStatus]);
    setLastChecked(new Date().toLocaleString('it-IT'));
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const appStatus = useMemo(() => {
    if (checks.some((check) => check.status === 'error')) {
      return { text: 'Problemi rilevati', color: '#b00020' };
    }
    if (checks.some((check) => check.status === 'warning' || check.status === 'checking')) {
      return { text: 'Stato parziale', color: '#a86d00' };
    }
    return { text: 'Operativa', color: '#1a7f37' };
  }, [checks]);

  const renderBadge = (status: ServiceStatus) => {
    if (status === 'ok') return <strong style={{ color: '#1a7f37' }}>OK</strong>;
    if (status === 'warning') return <strong style={{ color: '#a86d00' }}>ATTENZIONE</strong>;
    if (status === 'checking') return <strong style={{ color: '#4f4f4f' }}>CHECK...</strong>;
    return <strong style={{ color: '#b00020' }}>ERRORE</strong>;
  };

  return (
    <div>
      <h2>Info Service</h2>
      <p>
        Stato applicazione: <strong style={{ color: appStatus.color }}>{appStatus.text}</strong>
      </p>
      <p>Ultimo controllo: {lastChecked ?? 'in corso...'}</p>
      <button onClick={runChecks}>Riesegui controlli</button>
      <div
        style={{
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem'
        }}
      >
        {checks.map((check) => (
          <div
            key={check.name}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '0.75rem'
            }}
          >
            <div style={{ marginBottom: '0.25rem' }}>
              {check.name}: {renderBadge(check.status)}
            </div>
            <small>{check.details}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
