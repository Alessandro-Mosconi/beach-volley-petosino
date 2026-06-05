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
  posizione: number;
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
  fase_torneo_codice: string;
  girone_codice: string | null;
  avversaria_nome: string;
  set_vinti: number;
  set_persi: number;
  punti_fatti: number;
  punti_subiti: number;
  orario_inizio: string;
}

function getQualificationTier(position: number | null, gironeCodice: string | null) {
  if (position === null || !gironeCodice) return null;
  if (position <= 2) return 'gold';
  if (position <= 4) return 'silver';
  return null;
}

export default function TeamStats({ teamId, teams, tournamentId, onTeamChange }: TeamStatsProps) {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [setBreakdown, setSetBreakdown] = useState<SetBreakdownRow[]>([]);
  const [selectedSetStat, setSelectedSetStat] = useState<StatRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const team = teams.find((t) => t.codice === teamId);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      const [statsRes, breakdownRes] = await Promise.all([
        supabase
          .from('v_classifica_ordinata')
          .select(
            'fase_torneo_codice, fase_nome, girone_codice, girone_nome, posizione, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_fatti, punti_subiti, differenza_punti, punti_classifica'
          )
          .eq('torneo_id', tournamentId)
          .eq('squadra_codice', teamId)
          .order('fase_torneo_codice', { ascending: true }),
        supabase
          .from('v_partita_squadra')
          .select(
            'partita_id, fase_torneo_codice, girone_codice, avversaria_nome, set_vinti, set_persi, punti_fatti, punti_subiti, orario_inizio'
          )
          .eq('torneo_id', tournamentId)
          .eq('squadra_codice', teamId)
          .order('orario_inizio', { ascending: true })
      ]);

      if (statsRes.error || !statsRes.data || breakdownRes.error) {
        setStats([]);
        setSetBreakdown([]);
        setLoading(false);
        return;
      }

      const formatted: StatRow[] = statsRes.data.map((r) => ({
        fase_torneo_codice: r.fase_torneo_codice,
        fase_nome: r.fase_nome ?? '',
        girone_codice: r.girone_codice ?? null,
        girone_nome: r.girone_nome ?? null,
        posizione: r.posizione,
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

      setStats(formatted);
      setSetBreakdown(((breakdownRes.data ?? []) as SetBreakdownRow[]).filter((row) => row.set_vinti + row.set_persi > 0));
      setLoading(false);
    }

    fetchStats();

    const channel = supabase
      .channel(`stats-live-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'girone' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fase_torneo' }, () => fetchStats())
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
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-small" />
                  <col className="standings-col-sets" />
                  <col className="standings-col-score-points" />
                  <col className="standings-col-score-points" />
                  <col className="standings-col-score-points" />
                  <col className="standings-col-points" />
                </colgroup>

                <thead>
                  <tr>
                    <th>Fase</th>
                    <th>Girone</th>
                    <th>Pos</th>
                    <th>PG</th>
                    <th>V</th>
                    <th>N</th>
                    <th>P</th>
                    <th>Set V/P</th>
                    <th>PF</th>
                    <th>PS</th>
                    <th>Diff</th>
                    <th>Punti</th>
                  </tr>
                </thead>

                <tbody>
                  {stats.map((row, idx) => {
                    const qualificationTier = getQualificationTier(row.posizione, row.girone_codice);

                    return (
                      <tr key={idx} className={qualificationTier ? `standings-row-${qualificationTier}` : undefined}>
                        <td>{row.fase_nome}</td>
                        <td>{row.girone_nome ?? '-'}</td>
                        <td>
                          <span className="team-stats-position">
                            {row.posizione}
                            {qualificationTier && (
                              <span className={`standings-qualification standings-qualification-${qualificationTier}`}>
                                {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>{row.partite_giocate}</td>
                        <td>{row.partite_vinte}</td>
                        <td>{row.partite_pareggiate}</td>
                        <td>{row.partite_perse}</td>
                        <td>
                          {row.set_vinti} / {row.set_persi}
                        </td>
                        <td>{row.punti_fatti}</td>
                        <td>{row.punti_subiti}</td>
                        <td>{row.differenza_punti}</td>
                        <td>{row.girone_codice ? row.punti_classifica : '-'}</td>
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

              return (
                <article
                  key={`${row.fase_nome}-${row.girone_nome ?? 'fase'}-${idx}`}
                  className={qualificationTier ? `team-stats-card standings-row-${qualificationTier}` : 'team-stats-card'}
                >
                  <div className="team-stats-card-heading">
                    <span>{row.fase_nome}</span>
                    {row.girone_nome && <strong>{row.girone_nome}</strong>}
                    {qualificationTier && (
                      <small className={`standings-qualification standings-qualification-${qualificationTier}`}>
                        {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                      </small>
                    )}
                  </div>

                  <div className="team-stats-card-summary">
                    {row.girone_codice && (
                      <div className="team-stats-card-points">
                        <span>Punti classifica</span>
                        <strong>{row.punti_classifica}</strong>
                      </div>
                    )}

                    <div className="team-stats-card-position">
                      <small>Posizione</small>
                      <span>{row.posizione}</span>
                    </div>
                  </div>

                  <div className="team-stats-card-grid">
                    <div className="team-stats-stat-card">
                      <span>PG</span>
                      <strong>{row.partite_giocate}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>V</span>
                      <strong>{row.partite_vinte}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>N</span>
                      <strong>{row.partite_pareggiate}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>P</span>
                      <strong>{row.partite_perse}</strong>
                    </div>

                    <button
                      className="team-stats-stat-card team-stats-set-card"
                      type="button"
                      disabled={row.set_vinti + row.set_persi === 0}
                      onClick={() => setSelectedSetStat(row)}
                    >
                      <span>Set</span>
                      <strong>
                        {row.set_vinti} / {row.set_persi}
                      </strong>
                    </button>

                    <div className="team-stats-stat-card">
                      <span>PF</span>
                      <strong>{row.punti_fatti}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>PS</span>
                      <strong>{row.punti_subiti}</strong>
                    </div>

                    <div className="team-stats-stat-card">
                      <span>Diff</span>
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
                      <span>Set V/P</span>
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
                    <div className="standings-set-list">
                      {selectedSetRows.map((match) => (
                        <article key={match.partita_id} className="standings-set-card">
                          <div>
                            <span>Avversaria</span>
                            <strong>{match.avversaria_nome}</strong>
                          </div>

                          <div className="standings-set-card-score">
                            <span>Set</span>
                            <strong>
                              {match.set_vinti} / {match.set_persi}
                            </strong>
                          </div>

                          <div className="standings-set-card-points">
                            <span>Punti</span>
                            <strong>
                              {match.punti_fatti} / {match.punti_subiti}
                            </strong>
                          </div>
                        </article>
                      ))}
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
