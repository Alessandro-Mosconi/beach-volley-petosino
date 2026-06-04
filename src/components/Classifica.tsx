import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface ClassificaProps {
  faseName: string; // e.g. 'GIRONI'
  tournamentId: number;
}

interface TeamRow {
  posizione: number | null;
  squadra_codice: string;
  squadra_nome: string;
  partite_giocate: number;
  partite_vinte: number;
  partite_perse: number;
  set_vinti: number;
  set_persi: number;
  punti_classifica: number;
  girone_codice: string;
  girone_nome: string;
}

function getQualificationTier(position: number | null) {
  if (position === null) return null;
  if (position <= 2) return 'gold';
  if (position <= 4) return 'silver';
  return null;
}

export default function Classifica({ faseName, tournamentId }: ClassificaProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: classificaRows, error } = await supabase
        .from('v_classifica_gironi')
        .select(
          'posizione, squadra_codice, squadra_nome, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_classifica, girone_codice, girone_nome'
        )
        .eq('torneo_id', tournamentId)
        .order('girone_codice', { ascending: true })
        .order('posizione', { ascending: true });
      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [participantsRes, squadreRes, gironiRes] = await Promise.all([
        supabase.from('girone_squadra').select('girone_codice, squadra_codice'),
        supabase.from('squadra').select('codice, nome').eq('torneo_id', tournamentId),
        supabase.from('girone').select('codice, nome').eq('torneo_id', tournamentId)
      ]);

      if (participantsRes.error || squadreRes.error || gironiRes.error) {
        setRows([]);
        setLoading(false);
        return;
      }

      const squadraMap = new Map<string, string>();
      squadreRes.data?.forEach((s) => squadraMap.set(s.codice, s.nome));

      const gironeMap = new Map<string, string>();
      gironiRes.data?.forEach((g) => gironeMap.set(g.codice, g.nome));

      const classificaMap = new Map<string, TeamRow>();
      (classificaRows ?? []).forEach((r) => {
        const key = `${r.girone_codice}-${r.squadra_codice}`;
        classificaMap.set(key, {
          posizione: r.posizione,
          squadra_codice: r.squadra_codice,
          squadra_nome: r.squadra_nome ?? '',
          partite_giocate: r.partite_giocate,
          partite_vinte: r.partite_vinte,
          partite_perse: r.partite_perse,
          set_vinti: r.set_vinti,
          set_persi: r.set_persi,
          punti_classifica: r.punti_classifica,
          girone_codice: r.girone_codice,
          girone_nome: r.girone_nome ?? ''
        });
      });

      const mergedRows: TeamRow[] = (participantsRes.data ?? [])
        .filter((p) => gironeMap.has(p.girone_codice) && squadraMap.has(p.squadra_codice))
        .map((p) => {
        const key = `${p.girone_codice}-${p.squadra_codice}`;
        const ranked = classificaMap.get(key);
        if (ranked) return ranked;

        return {
          posizione: null,
          squadra_codice: p.squadra_codice,
          squadra_nome: squadraMap.get(p.squadra_codice) ?? '',
          partite_giocate: 0,
          partite_vinte: 0,
          partite_perse: 0,
          set_vinti: 0,
          set_persi: 0,
          punti_classifica: 0,
          girone_codice: p.girone_codice,
          girone_nome: gironeMap.get(p.girone_codice) ?? ''
        };
      });

      // Include eventual ranking rows even if not present in girone_squadra
      classificaMap.forEach((value) => {
        if (
          !mergedRows.some(
            (row) => row.girone_codice === value.girone_codice && row.squadra_codice === value.squadra_codice
          )
        ) {
          mergedRows.push(value);
        }
      });

      const formatted: TeamRow[] = mergedRows.sort((a, b) => {
        const groupCompare = a.girone_codice.localeCompare(b.girone_codice, 'it');
        if (groupCompare !== 0) return groupCompare;

        if (a.posizione === null && b.posizione !== null) return 1;
        if (a.posizione !== null && b.posizione === null) return -1;
        if (a.posizione !== null && b.posizione !== null && a.posizione !== b.posizione) {
          return a.posizione - b.posizione;
        }

        if (a.punti_classifica !== b.punti_classifica) return b.punti_classifica - a.punti_classifica;
        if (a.partite_vinte !== b.partite_vinte) return b.partite_vinte - a.partite_vinte;
        const setDiffA = a.set_vinti - a.set_persi;
        const setDiffB = b.set_vinti - b.set_persi;
        if (setDiffA !== setDiffB) return setDiffB - setDiffA;

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
        { event: '*', schema: 'public', table: 'partita' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita_set' },
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
  }, [faseName, tournamentId]);

  // Group rows by girone
  const groups: { [key: string]: TeamRow[] } = {};
  rows.forEach((r) => {
    const key = r.girone_codice || 'N/A';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div className="standings-view">
      <h2>Classifica - {faseName}</h2>
      {loading ? (
        <p>Caricamento classifiche...</p>
      ) : rows.length === 0 ? (
        <p>Nessuna classifica disponibile.</p>
      ) : (
        Object.keys(groups).sort((a, b) => a.localeCompare(b, 'it')).map((gironeCodice) => (
          <section key={gironeCodice} className="standings-group">
            <h3>Girone {groups[gironeCodice][0]?.girone_nome || gironeCodice}</h3>
            {groups[gironeCodice].every((row) => row.partite_giocate === 0) && (
              <p className="standings-note">
                Nessuna partita ancora giocata. Elenco partecipanti visibile.
              </p>
            )}
            <div className="standings-table-scroll">
              <table className="standings-table">
                <colgroup>
                  <col className="standings-col-pos" />
                  <col className="standings-col-team" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-sets" />
                  <col className="standings-col-points" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Squadra</th>
                    <th>PG</th>
                    <th>Vinte</th>
                    <th>Perse</th>
                    <th>Set V/P</th>
                    <th>Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[gironeCodice].map((row) => {
                    const qualificationTier = getQualificationTier(row.posizione);
                    return (
                      <tr
                        key={row.squadra_codice}
                        className={qualificationTier ? `standings-row-${qualificationTier}` : undefined}
                      >
                        <td>{row.posizione ?? '-'}</td>
                        <td>
                          <span className="standings-team-name">{row.squadra_nome}</span>
                          {qualificationTier && (
                            <span className={`standings-qualification standings-qualification-${qualificationTier}`}>
                              {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                            </span>
                          )}
                        </td>
                        <td>{row.partite_giocate}</td>
                        <td>{row.partite_vinte}</td>
                        <td>{row.partite_perse}</td>
                        <td>
                          {row.set_vinti} / {row.set_persi}
                        </td>
                        <td>{row.punti_classifica}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
