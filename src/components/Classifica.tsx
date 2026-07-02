import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';
import {
  getFallbackQualificationRules,
  getQualificationRule,
  parseQualificationRules,
  type QualificationRule
} from '../utils/qualificationRules';

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
  partite_pareggiate: number;
  partite_perse: number;
  set_vinti: number;
  set_persi: number;
  punti_fatti: number;
  punti_subiti: number;
  differenza_punti: number;
  punti_classifica: number;
  girone_codice: string;
  girone_nome: string;
}

interface SetBreakdownRow {
  partita_id: number;
  girone_codice: string;
  squadra_codice: string;
  avversaria_nome: string;
  set_vinti: number;
  set_persi: number;
  punti_fatti: number;
  punti_subiti: number;
  orario_inizio: string;
  risultato_squadra: string;
}

interface SetDetailRow {
  numero_set: number;
  vinto: boolean;
  punti_fatti: number;
  punti_subiti: number;
}

interface TournamentPhase {
  codice: string;
  nome: string;
  tipo: string;
}

function getMatchOutcome(match: SetBreakdownRow) {
  if (match.set_vinti === match.set_persi) return { label: 'Pareggio', className: 'standings-set-card-draw' };
  if (match.set_vinti > match.set_persi) return { label: 'Vinto', className: 'standings-set-card-won' };
  return { label: 'Perso', className: 'standings-set-card-lost' };
}

export default function Classifica({ faseName, tournamentId }: ClassificaProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [setBreakdownByTeam, setSetBreakdownByTeam] = useState<Record<string, SetBreakdownRow[]>>({});
  const [setDetailsByMatchTeam, setSetDetailsByMatchTeam] = useState<Record<string, SetDetailRow[]>>({});
  const [qualificationRules, setQualificationRules] = useState<QualificationRule[]>([]);
  const [selectedSetTeam, setSelectedSetTeam] = useState<TeamRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: classificaRows, error } = await supabase
        .from('v_classifica_gironi')
        .select(
          'posizione, squadra_codice, squadra_nome, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_fatti, punti_subiti, differenza_punti, punti_classifica, girone_codice, girone_nome'
        )
        .eq('torneo_id', tournamentId)
        .order('girone_codice', { ascending: true })
        .order('posizione', { ascending: true });
      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [participantsRes, squadreRes, gironiRes, setBreakdownRes, phasesRes, rulesRes] = await Promise.all([
        supabase.from('girone_squadra').select('girone_codice, squadra_codice').eq('torneo_id', tournamentId),
        supabase.from('squadra').select('codice, nome').eq('torneo_id', tournamentId),
        supabase.from('girone').select('codice, nome').eq('torneo_id', tournamentId),
        supabase
          .from('v_partita_squadra')
          .select(
            'partita_id, girone_codice, squadra_codice, avversaria_nome, set_vinti, set_persi, punti_fatti, punti_subiti, orario_inizio, risultato_squadra'
          )
          .eq('torneo_id', tournamentId)
          .eq('fase_torneo_codice', faseName)
          .order('orario_inizio', { ascending: true }),
        supabase.from('v_torneo_fase').select('codice, nome, tipo').eq('torneo_id', tournamentId),
        supabase.from('torneo_regolamento').select('contenuto').eq('torneo_id', tournamentId).maybeSingle()
      ]);

      if (participantsRes.error || squadreRes.error || gironiRes.error || setBreakdownRes.error || phasesRes.error) {
        setRows([]);
        setSetBreakdownByTeam({});
        setQualificationRules([]);
        setLoading(false);
        return;
      }

      const phases = (phasesRes.data ?? []) as TournamentPhase[];
      const rulesFromRegolamento = rulesRes.error ? [] : parseQualificationRules(rulesRes.data?.contenuto);
      setQualificationRules(
        rulesFromRegolamento.length > 0 ? rulesFromRegolamento : getFallbackQualificationRules(phases)
      );

      const matchIds = Array.from(new Set((setBreakdownRes.data ?? []).map((match) => match.partita_id)));
      const [matchTeamsRes, setDetailsRes] = matchIds.length > 0
        ? await Promise.all([
            supabase
              .from('v_partita_risultato')
              .select('partita_id, squadra_1_codice, squadra_2_codice')
              .in('partita_id', matchIds),
            supabase
              .from('partita_set')
              .select('partita_id, numero_set, punteggio_squadra_1, punteggio_squadra_2, squadra_vincitrice_codice')
              .in('partita_id', matchIds)
              .order('numero_set', { ascending: true })
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      if (matchTeamsRes.error || setDetailsRes.error) {
        setRows([]);
        setSetBreakdownByTeam({});
        setSetDetailsByMatchTeam({});
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
          partite_pareggiate: Math.max(0, r.partite_giocate - r.partite_vinte - r.partite_perse),
          partite_perse: r.partite_perse,
          set_vinti: r.set_vinti,
          set_persi: r.set_persi,
          punti_fatti: r.punti_fatti,
          punti_subiti: r.punti_subiti,
          differenza_punti: r.differenza_punti,
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
          partite_pareggiate: 0,
          partite_perse: 0,
          set_vinti: 0,
          set_persi: 0,
          punti_fatti: 0,
          punti_subiti: 0,
          differenza_punti: 0,
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
        if (a.differenza_punti !== b.differenza_punti) return b.differenza_punti - a.differenza_punti;

        return a.squadra_nome.localeCompare(b.squadra_nome, 'it');
      });

      setRows(formatted);
      const nextBreakdownByTeam: Record<string, SetBreakdownRow[]> = {};
      ((setBreakdownRes.data ?? []) as SetBreakdownRow[])
        .filter((match) => match.set_vinti + match.set_persi > 0)
        .forEach((match) => {
          const key = `${match.girone_codice}-${match.squadra_codice}`;
          if (!nextBreakdownByTeam[key]) nextBreakdownByTeam[key] = [];
          nextBreakdownByTeam[key].push(match);
        });
      setSetBreakdownByTeam(nextBreakdownByTeam);

      const matchTeams = new Map<number, { team1: string; team2: string }>();
      matchTeamsRes.data?.forEach((match) => {
        matchTeams.set(match.partita_id, {
          team1: match.squadra_1_codice,
          team2: match.squadra_2_codice
        });
      });

      const nextSetDetailsByMatchTeam: Record<string, SetDetailRow[]> = {};
      setDetailsRes.data?.forEach((set) => {
        const matchTeamsRow = matchTeams.get(set.partita_id);
        if (!matchTeamsRow) return;

        const details = [
          {
            teamCode: matchTeamsRow.team1,
            punti_fatti: set.punteggio_squadra_1,
            punti_subiti: set.punteggio_squadra_2
          },
          {
            teamCode: matchTeamsRow.team2,
            punti_fatti: set.punteggio_squadra_2,
            punti_subiti: set.punteggio_squadra_1
          }
        ];

        details.forEach((detail) => {
          const key = `${set.partita_id}-${detail.teamCode}`;
          if (!nextSetDetailsByMatchTeam[key]) nextSetDetailsByMatchTeam[key] = [];
          nextSetDetailsByMatchTeam[key].push({
            numero_set: set.numero_set,
            vinto: set.squadra_vincitrice_codice === detail.teamCode,
            punti_fatti: detail.punti_fatti,
            punti_subiti: detail.punti_subiti
          });
        });
      });
      setSetDetailsByMatchTeam(nextSetDetailsByMatchTeam);
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'torneo_regolamento', filter: `torneo_id=eq.${tournamentId}` },
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

  const selectedSetRows = selectedSetTeam
    ? setBreakdownByTeam[`${selectedSetTeam.girone_codice}-${selectedSetTeam.squadra_codice}`] ?? []
    : [];

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
            <div className="standings-table-scroll">
              <table className="standings-table">
                <colgroup>
                  <col className="standings-col-pos" />
                  <col className="standings-col-team" />
                  <col className="standings-col-points" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-sets" />
                  <col className="standings-col-score-points" />
                  <col className="standings-col-score-points" />
                  <col className="standings-col-score-points" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Squadra</th>
                    <th>Punti</th>
                    <th>PG</th>
                    <th>Vinte</th>
                    <th>Pari</th>
                    <th>Perse</th>
                    <th>Set V/P</th>
                    <th>PF</th>
                    <th>PS</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[gironeCodice].map((row) => {
                    const qualificationRule = getQualificationRule(row.posizione, qualificationRules);
                    const hasSetDetails = row.set_vinti + row.set_persi > 0;
                    return (
                      <tr
                        key={row.squadra_codice}
                        className={[
                          qualificationRule ? `standings-row-${qualificationRule.variant}` : '',
                          hasSetDetails ? 'standings-clickable-row' : ''
                        ].filter(Boolean).join(' ') || undefined}
                        tabIndex={hasSetDetails ? 0 : undefined}
                        role={hasSetDetails ? 'button' : undefined}
                        aria-label={hasSetDetails ? `Apri scontri di ${row.squadra_nome}` : undefined}
                        onClick={hasSetDetails ? () => setSelectedSetTeam(row) : undefined}
                        onKeyDown={(event) => {
                          if (!hasSetDetails) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedSetTeam(row);
                          }
                        }}
                      >
                        <td>{row.posizione ?? '-'}</td>
                        <td>
                          <div className="standings-team-cell">
                            <span className="standings-team-name">{row.squadra_nome}</span>
                            {qualificationRule && (
                              <span className={`standings-qualification standings-qualification-${qualificationRule.variant}`}>
                                {qualificationRule.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{row.punti_classifica}</td>
                        <td>{row.partite_giocate}</td>
                        <td>{row.partite_vinte}</td>
                        <td>{row.partite_pareggiate}</td>
                        <td>{row.partite_perse}</td>
                        <td>
                          <span className="standings-set-value">{row.set_vinti} / {row.set_persi}</span>
                        </td>
                        <td>{row.punti_fatti}</td>
                        <td>{row.punti_subiti}</td>
                        <td>{row.differenza_punti}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      {selectedSetTeam &&
        createPortal(
          <div className="standings-set-modal-backdrop" role="presentation" onClick={() => setSelectedSetTeam(null)}>
            <section className="standings-set-modal" role="dialog" aria-modal="true" aria-labelledby="set-detail-title" onClick={(event) => event.stopPropagation()}>
              <div className="standings-set-modal-heading">
                <div>
                  <span>Scontri</span>
                  <h3 id="set-detail-title">{selectedSetTeam.squadra_nome}</h3>
                </div>
                <button type="button" onClick={() => setSelectedSetTeam(null)} aria-label="Chiudi dettaglio set">
                  X
                </button>
              </div>

              {selectedSetRows.length === 0 ? (
                <p className="standings-set-empty">Nessun set giocato per questa squadra.</p>
              ) : (
                <div className="standings-set-list standings-set-list-scroll">
                  {selectedSetRows.map((match) => {
                    const setDetails = setDetailsByMatchTeam[`${match.partita_id}-${match.squadra_codice}`] ?? [];
                    const outcome = getMatchOutcome(match);
                    return (
                      <article key={match.partita_id} className={`standings-set-card ${outcome.className}`}>
                        <div className="standings-set-card-matchup">
                          <span>Scontro diretto</span>
                          <strong>{selectedSetTeam.squadra_nome}</strong>
                          <small>contro {match.avversaria_nome}</small>
                        </div>
                        <div className="standings-set-card-summary">
                          <span className="standings-set-outcome">{outcome.label}</span>
                          <strong>
                            {match.set_vinti} set vinti, {match.set_persi} persi
                          </strong>
                          <small>{match.punti_fatti} punti fatti, {match.punti_subiti} subiti</small>
                        </div>
                        <div className="standings-set-chip-list" aria-label="Dettaglio set">
                          {setDetails.map((setDetail) => (
                            <span
                              key={setDetail.numero_set}
                              className={`standings-set-chip ${setDetail.vinto ? 'standings-set-chip-won' : 'standings-set-chip-lost'}`}
                            >
                              Set {setDetail.numero_set}: {setDetail.vinto ? 'vinto' : 'perso'} {setDetail.punti_fatti}-{setDetail.punti_subiti}
                            </span>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>,
          document.body
        )}
    </div>
  );
}
