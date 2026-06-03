import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface Team {
  id: number;
  nome: string;
  orario_pranzo: string | null;
}

interface MatchEvent {
  id: number;
  orario_inizio: string;
  campo: string;
  opponent: string;
  role: 'player' | 'referee';
}

interface AgendaProps {
  teamId: number;
  teams: Team[];
}

export default function Agenda({ teamId, teams }: AgendaProps) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const team = teams.find((t) => t.id === teamId);
  const lunchTime = team?.orario_pranzo ?? null;

  useEffect(() => {
    async function fetchAgenda() {
      setLoading(true);
      // Fetch all matches where the team participates or referees
      const { data: matches, error } = await supabase
        .from('partita')
        .select('*')
        .or(
          `squadra_1_id.eq.${teamId},squadra_2_id.eq.${teamId},squadra_arbitro_id.eq.${teamId}`
        )
        .order('orario_inizio', { ascending: true });

      if (error || !matches) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch all fields and teams for name resolution
      const { data: campos } = await supabase.from('campo').select('id, nome');
      const { data: squadre } = await supabase
        .from('squadra')
        .select('id, nome');

      const campoMap = new Map<number, string>();
      campos?.forEach((c) => campoMap.set(c.id, c.nome));

      const squadraMap = new Map<number, string>();
      squadre?.forEach((s) => squadraMap.set(s.id, s.nome));

      const eventsList: MatchEvent[] = matches.map((m) => {
        const isReferee = m.squadra_arbitro_id === teamId;
        // Determine opponent
        let opponentName = '';
        if (m.squadra_1_id === teamId) {
          opponentName = squadraMap.get(m.squadra_2_id) ?? '';
        } else if (m.squadra_2_id === teamId) {
          opponentName = squadraMap.get(m.squadra_1_id) ?? '';
        } else {
          // referee, pick both teams names
          const teamA = squadraMap.get(m.squadra_1_id) ?? '';
          const teamB = squadraMap.get(m.squadra_2_id) ?? '';
          opponentName = `${teamA} vs ${teamB}`;
        }
        return {
          id: m.id,
          orario_inizio: m.orario_inizio,
          campo: campoMap.get(m.campo_id) ?? '',
          opponent: opponentName,
          role: isReferee ? 'referee' : 'player'
        };
      });
      setEvents(eventsList);
      setLoading(false);
    }
    fetchAgenda();

    const channel = supabase
      .channel(`agenda-live-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campo' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchAgenda()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  };

  return (
    <div>
      <h2>Agenda giornaliera</h2>
      {lunchTime && (
        <p>
          Orario pranzo della squadra: <strong>{lunchTime}</strong>
        </p>
      )}
      {loading ? (
        <p>Caricamento partite...</p>
      ) : events.length === 0 ? (
        <p>Nessuna partita programmata per la squadra selezionata.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {events.map((e) => (
            <li
              key={e.id}
              className={`agenda-event-card ${
                e.role === 'referee' ? 'agenda-event-card-referee' : 'agenda-event-card-player'
              }`}
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '0.75rem',
                marginBottom: '0.5rem'
              }}
            >
              <div>
                <strong>{formatDateTime(e.orario_inizio)}</strong>
              </div>
              <div>Campo: {e.campo}</div>
              <div>
                {e.role === 'referee' ? 'Arbitro per' : 'Contro'}: {e.opponent}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}