import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface ClassificaProps {
  faseName: string; // e.g. 'GIRONI'
}

interface TeamRow {
  posizione: number | null;
  squadra_id: number;
  squadra_nome: string;
  partite_giocate: number;
  partite_vinte: number;
  partite_perse: number;
  set_vinti: number;
  set_persi: number;
  punti_classifica: number;
  girone_id: number;
  girone_nome: string;
}

export default function Classifica({ faseName }: ClassificaProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Get phase id
      const { data: fase, error: faseErr } = await supabase
        .from('fase_torneo')
        .select('id')
        .eq('nome', faseName)
        .single();
      if (faseErr || !fase) {
        setRows([]);
        setLoading(false);
        return;
      }
      const faseId = fase.id;
      // Fetch classifica with joins to squadra and girone
      const { data: classificaRows, error } = await supabase
        .from('classifica')
        .select(
          `posizione, squadra_id, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_classifica, girone_id, squadra: squadra (nome), girone: girone (nome)`
        )
        .eq('fase_torneo_id', faseId)
        .order('girone_id', { ascending: true })
        .order('posizione', { ascending: true });
      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: participants, error: participantsError } = await supabase
        .from('girone_squadra')
        .select('girone_id, squadra_id, squadra:squadra(nome), girone:girone(nome)');

      if (participantsError) {
        setRows([]);
        setLoading(false);
        return;
      }

      const classificaMap = new Map<string, TeamRow>();
      (classificaRows ?? []).forEach((r) => {
        const key = `${r.girone_id}-${r.squadra_id}`;
        classificaMap.set(key, {
          posizione: r.posizione,
          squadra_id: r.squadra_id,
          squadra_nome: r.squadra?.nome ?? '',
          partite_giocate: r.partite_giocate,
          partite_vinte: r.partite_vinte,
          partite_perse: r.partite_perse,
          set_vinti: r.set_vinti,
          set_persi: r.set_persi,
          punti_classifica: r.punti_classifica,
          girone_id: r.girone_id,
          girone_nome: r.girone?.nome ?? ''
        });
      });

      const mergedRows: TeamRow[] = (participants ?? []).map((p) => {
        const key = `${p.girone_id}-${p.squadra_id}`;
        const ranked = classificaMap.get(key);
        if (ranked) return ranked;

        return {
          posizione: null,
          squadra_id: p.squadra_id,
          squadra_nome: p.squadra?.nome ?? '',
          partite_giocate: 0,
          partite_vinte: 0,
          partite_perse: 0,
          set_vinti: 0,
          set_persi: 0,
          punti_classifica: 0,
          girone_id: p.girone_id,
          girone_nome: p.girone?.nome ?? ''
        };
      });

      // Include eventual ranking rows even if not present in girone_squadra
      classificaMap.forEach((value) => {
        if (
          !mergedRows.some(
            (row) => row.girone_id === value.girone_id && row.squadra_id === value.squadra_id
          )
        ) {
          mergedRows.push(value);
        }
      });

      const formatted: TeamRow[] = mergedRows.sort((a, b) => {
        const groupCompare = a.girone_nome.localeCompare(b.girone_nome, 'it');
        if (groupCompare !== 0) return groupCompare;
        if (a.posizione === null && b.posizione !== null) return 1;
        if (a.posizione !== null && b.posizione === null) return -1;
        if (a.posizione !== null && b.posizione !== null && a.posizione !== b.posizione) {
          return a.posizione - b.posizione;
        }
        return a.squadra_nome.localeCompare(b.squadra_nome, 'it');
      });

      setRows(formatted);
      setLoading(false);
    }
    fetchData();

    const channel = supabase
      .channel(`classifica-live-${faseName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classifica' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'girone_squadra' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'girone' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName]);

  // Group rows by girone
  const groups: { [key: string]: TeamRow[] } = {};
  rows.forEach((r) => {
    const key = r.girone_nome || 'N/A';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div>
      <h2>Classifica - {faseName}</h2>
      {loading ? (
        <p>Caricamento classifiche...</p>
      ) : rows.length === 0 ? (
        <p>Nessuna classifica disponibile.</p>
      ) : (
        Object.keys(groups).map((gironeNome) => (
          <div key={gironeNome} style={{ marginBottom: '1.5rem' }}>
            <h3>Girone {gironeNome}</h3>
            {groups[gironeNome].every((row) => row.partite_giocate === 0) && (
              <p style={{ margin: '0.35rem 0 0', opacity: 0.8 }}>
                Nessuna partita ancora giocata. Elenco partecipanti visibile.
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginTop: '0.5rem',
                  minWidth: '580px'
                }}
              >
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Pos</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Squadra</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>PG</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Vinte</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Perse</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Set V/P</th>
                    <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[gironeNome].map((row) => (
                    <tr key={row.squadra_id}>
                      <td style={{ padding: '0.25rem' }}>{row.posizione ?? '-'}</td>
                      <td style={{ padding: '0.25rem' }}>{row.squadra_nome}</td>
                      <td style={{ padding: '0.25rem' }}>{row.partite_giocate}</td>
                      <td style={{ padding: '0.25rem' }}>{row.partite_vinte}</td>
                      <td style={{ padding: '0.25rem' }}>{row.partite_perse}</td>
                      <td style={{ padding: '0.25rem' }}>
                        {row.set_vinti} / {row.set_persi}
                      </td>
                      <td style={{ padding: '0.25rem' }}>{row.punti_classifica}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}