import { useEffect, useState } from 'react';
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
  fase_nome: string;
  girone_nome: string | null;
  posizione: number;
  partite_giocate: number;
  partite_vinte: number;
  partite_perse: number;
  set_vinti: number;
  set_persi: number;
  punti_classifica: number;
}

function getQualificationTier(position: number | null) {
  if (position === null) return null;
  if (position <= 2) return 'gold';
  if (position <= 4) return 'silver';
  return null;
}

export default function TeamStats({ teamId, teams, tournamentId, onTeamChange }: TeamStatsProps) {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const team = teams.find((t) => t.codice === teamId);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_classifica_ordinata')
        .select(
          'fase_nome, girone_nome, posizione, partite_giocate, partite_vinte, partite_perse, set_vinti, set_persi, punti_classifica, fase_torneo_codice'
        )
        .eq('torneo_id', tournamentId)
        .eq('squadra_codice', teamId)
        .order('fase_torneo_codice', { ascending: true });
      if (error || !data) {
        setStats([]);
        setLoading(false);
        return;
      }
      const formatted: StatRow[] = data.map((r) => ({
        fase_nome: r.fase_nome ?? '',
        girone_nome: r.girone_nome ?? null,
        posizione: r.posizione,
        partite_giocate: r.partite_giocate,
        partite_vinte: r.partite_vinte,
        partite_perse: r.partite_perse,
        set_vinti: r.set_vinti,
        set_persi: r.set_persi,
        punti_classifica: r.punti_classifica
      }));
      setStats(formatted);
      setLoading(false);
    }
    fetchStats();

    const channel = supabase
      .channel(`stats-live-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita_set' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'girone' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fase_torneo' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, tournamentId]);

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
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '0.5rem',
              minWidth: '640px'
            }}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Fase</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Girone</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Pos</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>PG</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>V</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>P</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Set V/P</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Punti</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, idx) => {
                const qualificationTier = getQualificationTier(row.posizione);
                return (
                  <tr
                    key={idx}
                    className={qualificationTier ? `standings-row-${qualificationTier}` : undefined}
                  >
                    <td style={{ padding: '0.25rem' }}>{row.fase_nome}</td>
                    <td style={{ padding: '0.25rem' }}>{row.girone_nome ?? '-'}</td>
                    <td style={{ padding: '0.25rem' }}>
                      <span className="team-stats-position">
                        {row.posizione}
                        {qualificationTier && (
                          <span className={`standings-qualification standings-qualification-${qualificationTier}`}>
                            {qualificationTier === 'gold' ? 'Gold' : 'Silver'}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '0.25rem' }}>{row.partite_giocate}</td>
                    <td style={{ padding: '0.25rem' }}>{row.partite_vinte}</td>
                    <td style={{ padding: '0.25rem' }}>{row.partite_perse}</td>
                    <td style={{ padding: '0.25rem' }}>
                      {row.set_vinti} / {row.set_persi}
                    </td>
                    <td style={{ padding: '0.25rem' }}>{row.punti_classifica}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
