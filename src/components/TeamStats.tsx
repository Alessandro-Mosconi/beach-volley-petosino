import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';

interface Team {
  codice: string;
  nome: string;
  orario_pranzo: string | null;
}

interface TeamStatsProps {
  teamId: string;
  teams: Team[];
  tournamentId: number;
  onTeamChange: (teamId: string) => void;
}

interface StatRow {
  fase_torneo_codice: string;
  fase_nome: string;
  girone_nome: string | null;
  girone_codice: string | null;
  posizione: number | null;
  tabellone_turno: string | null;
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
}

interface SetBreakdownRow {
  partita_id: number;
  squadra_codice: string;
  fase_torneo_codice: string;
  girone_codice: string | null;
  slot_tabellone: string | null;
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

interface PhaseOption {
  codice: string;
  nome: string;
  tipo: string;
}

function getQualificationTier(position: number | null, gironeCodice: string | null) {
  if (position === null || !gironeCodice) return null;
  if (position <= 2) return 'gold';
  if (position <= 4) return 'silver';
  return null;
}

function getMatchOutcome(match: SetBreakdownRow) {
  if (match.set_vinti === match.set_persi) return { label: 'Pareggio', className: 'standings-set-card-draw' };
  if (match.set_vinti > match.set_persi) return { label: 'Vinto', className: 'standings-set-card-won' };
  return { label: 'Perso', className: 'standings-set-card-lost' };
}

function isBracketPhase(phaseCode: string, bracketPhaseCodes: Set<string>) {
  return bracketPhaseCodes.has(phaseCode);
}

function getBracketSlotRank(slot: string | null) {
  if (!slot) return 0;
  if (slot.startsWith('QUARTI')) return 1;
  if (slot.startsWith('SEMIFINALE')) return 2;
  if (slot === 'FINALE' || slot === 'FINALINA') return 3;
  return 0;
}

function formatBracketSlot(slot: string | null) {
  if (!slot) return '-';
  if (slot.startsWith('QUARTI')) return 'Quarti';
  if (slot.startsWith('SEMIFINALE')) return 'Semifinale';
  if (slot === 'FINALE') return 'Finale';
  if (slot === 'FINALINA') return 'Finalina';
  return slot;
}

export default function TeamStats({ teamId, teams, tournamentId, onTeamChange }: TeamStatsProps) {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [setBreakdown, setSetBreakdown] = useState<SetBreakdownRow[]>([]);
  const [setDetailsByMatchTeam, setSetDetailsByMatchTeam] = useState<Record<string, SetDetailRow[]>>({});
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [selectedSetStat, setSelectedSetStat] = useState<StatRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const team = teams.find((t) => t.codice === teamId);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      const [statsRes, breakdownRes, finalRankingRes, phasesRes] = await Promise.all([
        supabase
          .from('v_classifica_ordinata')
          .select(
            'fase_torneo_codice, fase_nome, girone_codice, girone_nome, posizione, squadra_nome, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_fatti, punti_subiti, differenza_punti, punti_classifica'
          )
          .eq('torneo_id', tournamentId)
          .eq('squadra_codice', teamId)
          .order('fase_torneo_codice', { ascending: true }),
        supabase
          .from('v_partita_squadra')
          .select(
            'partita_id, squadra_codice, fase_torneo_codice, girone_codice, slot_tabellone, avversaria_nome, set_vinti, set_persi, punti_fatti, punti_subiti, orario_inizio, risultato_squadra'
          )
          .eq('torneo_id', tournamentId)
          .eq('squadra_codice', teamId)
          .order('orario_inizio', { ascending: true }),
        supabase
          .from('v_classifica_finale')
          .select('fase_torneo_codice, posizione')
          .eq('torneo_id', tournamentId)
          .eq('squadra_codice', teamId),
        supabase
          .from('v_torneo_fase')
          .select('codice, nome, tipo')
          .eq('torneo_id', tournamentId)
      ]);

      if (statsRes.error || !statsRes.data || breakdownRes.error || finalRankingRes.error || phasesRes.error) {
        setStats([]);
        setSetBreakdown([]);
        setSetDetailsByMatchTeam({});
        setLoading(false);
        return;
      }

      const nextPhases = (phasesRes.data ?? []) as PhaseOption[];
      const bracketPhaseCodes = new Set(
        nextPhases
          .filter((phase) => phase.tipo === 'ELIMINAZIONE_DIRETTA')
          .map((phase) => phase.codice)
      );
      const phaseNameByCode = new Map(nextPhases.map((phase) => [phase.codice, phase.nome]));

      const matchIds = Array.from(new Set((breakdownRes.data ?? []).map((match) => match.partita_id)));
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
        setStats([]);
        setSetBreakdown([]);
        setSetDetailsByMatchTeam({});
        setLoading(false);
        return;
      }

      const finalPositionByPhase = new Map<string, number>();
      finalRankingRes.data?.forEach((row) => {
        finalPositionByPhase.set(row.fase_torneo_codice, row.posizione);
      });

      const bracketSlotByPhase = new Map<string, string>();
      (breakdownRes.data ?? []).forEach((match) => {
        if (!isBracketPhase(match.fase_torneo_codice, bracketPhaseCodes)) return;
        const currentSlot = bracketSlotByPhase.get(match.fase_torneo_codice) ?? null;
        if (getBracketSlotRank(match.slot_tabellone) > getBracketSlotRank(currentSlot)) {
          bracketSlotByPhase.set(match.fase_torneo_codice, match.slot_tabellone ?? '');
        }
      });

      const formatted: StatRow[] = statsRes.data.map((r) => ({
        fase_torneo_codice: r.fase_torneo_codice,
        fase_nome: r.fase_nome ?? phaseNameByCode.get(r.fase_torneo_codice) ?? r.fase_torneo_codice,
        girone_codice: r.girone_codice ?? null,
        girone_nome: r.girone_nome ?? null,
        posizione: isBracketPhase(r.fase_torneo_codice, bracketPhaseCodes)
          ? finalPositionByPhase.get(r.fase_torneo_codice) ?? null
          : r.posizione,
        tabellone_turno: isBracketPhase(r.fase_torneo_codice, bracketPhaseCodes)
          ? formatBracketSlot(bracketSlotByPhase.get(r.fase_torneo_codice) ?? null)
          : null,
        squadra_nome: r.squadra_nome ?? team?.nome ?? '',
        partite_giocate: r.partite_giocate,
        partite_vinte: r.partite_vinte,
        partite_pareggiate: Math.max(0, r.partite_giocate - r.partite_vinte - r.partite_perse),
        partite_perse: r.partite_perse,
        set_vinti: r.set_vinti,
        set_persi: r.set_persi,
        punti_fatti: r.punti_fatti,
        punti_subiti: r.punti_subiti,
        differenza_punti: r.differenza_punti,
        punti_classifica: r.punti_classifica
      }));

      bracketSlotByPhase.forEach((slot, phaseCode) => {
        if (formatted.some((row) => row.fase_torneo_codice === phaseCode)) return;
        formatted.push({
          fase_torneo_codice: phaseCode,
          fase_nome: phaseNameByCode.get(phaseCode) ?? phaseCode,
          girone_codice: null,
          girone_nome: null,
          posizione: finalPositionByPhase.get(phaseCode) ?? null,
          tabellone_turno: formatBracketSlot(slot),
          squadra_nome: team?.nome ?? '',
          partite_giocate: 0,
          partite_vinte: 0,
          partite_pareggiate: 0,
          partite_perse: 0,
          set_vinti: 0,
          set_persi: 0,
          punti_fatti: 0,
          punti_subiti: 0,
          differenza_punti: 0,
          punti_classifica: 0
        });
      });

      setPhases(nextPhases);
      setStats(formatted);
      setSetBreakdown(((breakdownRes.data ?? []) as SetBreakdownRow[]).filter((row) => row.set_vinti + row.set_persi > 0));
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

    fetchStats();

    const channel = supabase
      .channel(`stats-live-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'girone' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fase_torneo' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneo_fase' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, tournamentId]);

  const selectedSetRows = selectedSetStat
    ? setBreakdown.filter(
        (row) =>
          row.fase_torneo_codice === selectedSetStat.fase_torneo_codice &&
          (row.girone_codice ?? '') === (selectedSetStat.girone_codice ?? '')
      )
    : [];
  const bracketPhaseCodes = new Set(
    phases.filter((phase) => phase.tipo === 'ELIMINAZIONE_DIRETTA').map((phase) => phase.codice)
  );

  return (
    <div className="team-stats-view">
      <div className="team-stats-heading">
        <h2>Statistiche squadra: {team?.nome}</h2>

        <label className="team-select stats-team-select">
          Squadra
          <select value={teamId} onChange={(event) => onTeamChange(event.target.value)}>
            {teams.map((teamOption) => (
              <option key={teamOption.codice} value={teamOption.codice}>
                {teamOption.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Caricamento statistiche...</p>
      ) : stats.length === 0 ? (
        <p>Nessuna statistica disponibile per questa squadra.</p>
      ) : (
        <>
          <section className="standings-group team-stats-table-group">
            <div className="standings-table-scroll">
              <table className="standings-table team-stats-table">
                <colgroup>
                  <col className="team-stats-col-phase" />
                  <col className="team-stats-col-group" />
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
                    <th>Fase</th>
                    <th>Dettaglio</th>
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
                  {stats.map((row, idx) => {
                    const qualificationTier = getQualificationTier(row.posizione, row.girone_codice);
                    const hasSetDetails = row.set_vinti + row.set_persi > 0;
                    const isBracket = isBracketPhase(row.fase_torneo_codice, bracketPhaseCodes);

                    return (
                      <tr
                        key={idx}
                        className={[
                          qualificationTier ? `standings-row-${qualificationTier}` : '',
                          hasSetDetails ? 'standings-clickable-row' : ''
                        ].filter(Boolean).join(' ') || undefined}
                        tabIndex={hasSetDetails ? 0 : undefined}
                        role={hasSetDetails ? 'button' : undefined}
                        aria-label={hasSetDetails ? `Apri scontri di ${row.squadra_nome} in ${row.fase_nome}` : undefined}
                        onClick={hasSetDetails ? () => setSelectedSetStat(row) : undefined}
                        onKeyDown={(event) => {
                          if (!hasSetDetails) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedSetStat(row);
                          }
                        }}
                      >
                        <td>{row.fase_nome}</td>
                        <td>{isBracket ? row.tabellone_turno ?? '-' : row.girone_nome ?? '-'}</td>
                        <td>
                          <span className="team-stats-position">
                            {row.posizione ?? '-'}
                            {qualificationTier && (
                              <span className={`standings-qualification standings-qualification-${qualificationTier}`}>
                                {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="standings-team-cell">
                            <span className="standings-team-name">{row.squadra_nome}</span>
                          </div>
                        </td>
                        <td>{isBracket ? '-' : row.punti_classifica}</td>
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

          <div className="team-stats-mobile-list">
            {stats.map((row, idx) => {
              const qualificationTier = getQualificationTier(row.posizione, row.girone_codice);
              const hasSetDetails = row.set_vinti + row.set_persi > 0;
              const isBracket = isBracketPhase(row.fase_torneo_codice, bracketPhaseCodes);

              return (
                <article
                  key={`${row.fase_nome}-${row.girone_nome ?? 'fase'}-${idx}`}
                  className={[
                    'team-stats-card',
                    qualificationTier ? `standings-row-${qualificationTier}` : '',
                    hasSetDetails ? 'team-stats-card-clickable' : ''
                  ].filter(Boolean).join(' ')}
                  tabIndex={hasSetDetails ? 0 : undefined}
                  role={hasSetDetails ? 'button' : undefined}
                  aria-label={hasSetDetails ? `Apri scontri di ${row.squadra_nome} in ${row.fase_nome}` : undefined}
                  onClick={hasSetDetails ? () => setSelectedSetStat(row) : undefined}
                  onKeyDown={(event) => {
                    if (!hasSetDetails) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedSetStat(row);
                    }
                  }}
                >
                  <div className="team-stats-card-heading">
                    <div className="team-stats-card-title">
                      <span>{row.fase_nome}</span>
                      {!isBracket && row.girone_nome && <strong>{row.girone_nome}</strong>}
                      {qualificationTier && (
                        <small className={`standings-qualification standings-qualification-${qualificationTier}`}>
                          {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="team-stats-card-summary">
                    {isBracket ? (
                      <div className="team-stats-card-points">
                        <span>Turno tabellone</span>
                        <strong>{row.tabellone_turno ?? '-'}</strong>
                      </div>
                    ) : (
                      <div className="team-stats-card-points">
                        <span>Punti classifica</span>
                        <strong>{row.punti_classifica}</strong>
                      </div>
                    )}

                    <div className="team-stats-card-position">
                      <small>Posizione</small>
                      <span>{row.posizione ?? '-'}</span>
                    </div>
                  </div>

                  <div className="team-stats-card-grid">
                    <div className="team-stats-stat-card">
                      <span>Giocate</span>
                      <strong>{row.partite_giocate}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Vinte</span>
                      <strong>{row.partite_vinte}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Pareggiate</span>
                      <strong>{row.partite_pareggiate}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Perse</span>
                      <strong>{row.partite_perse}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Set vinti</span>
                      <strong>{row.set_vinti}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Set persi</span>
                      <strong>{row.set_persi}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Punti fatti</span>
                      <strong>{row.punti_fatti}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Punti subiti</span>
                      <strong>{row.punti_subiti}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Differenza punti</span>
                      <strong>{row.differenza_punti}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {selectedSetStat &&
            createPortal(
              <div className="standings-set-modal-backdrop" role="presentation" onClick={() => setSelectedSetStat(null)}>
                <section
                  className="standings-set-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="team-set-detail-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="standings-set-modal-heading">
                    <div>
                      <span>Scontri</span>
                      <h3 id="team-set-detail-title">
                        {selectedSetStat.fase_nome}
                        {selectedSetStat.girone_nome ? ` - ${selectedSetStat.girone_nome}` : ''}
                      </h3>
                    </div>

                    <button type="button" onClick={() => setSelectedSetStat(null)} aria-label="Chiudi dettaglio set">
                      X
                    </button>
                  </div>

                  {selectedSetRows.length === 0 ? (
                    <p className="standings-set-empty">Nessun set giocato in questa fase.</p>
                  ) : (
                    <div className="standings-set-list standings-set-list-scroll">
                      {selectedSetRows.map((match) => {
                        const setDetails = setDetailsByMatchTeam[`${match.partita_id}-${match.squadra_codice}`] ?? [];
                        const outcome = getMatchOutcome(match);
                        return (
                          <article key={match.partita_id} className={`standings-set-card ${outcome.className}`}>
                            <div className="standings-set-card-matchup">
                              <span>Scontro diretto</span>
                              <strong>{team?.nome ?? selectedSetStat.squadra_nome}</strong>
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
        </>
      )}
    </div>
  );
}
