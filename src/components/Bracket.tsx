import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface BracketProps {
  faseName: string; // 'GOLD' or 'SILVER'
}

interface MatchData {
  id: number;
  numero_partita: number | null;
  squadra_1_id: number | null;
  squadra_2_id: number | null;
  squadra_1_nome: string;
  squadra_2_nome: string;
  setWins1: number;
  setWins2: number;
  winner: number | null;
  isPlaceholder?: boolean;
}

export default function Bracket({ faseName }: BracketProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      // Get phase id
      const { data: fase, error: faseErr } = await supabase
        .from('fase_torneo')
        .select('id')
        .eq('nome', faseName)
        .single();
      if (faseErr || !fase) {
        setMatches([]);
        setLoading(false);
        return;
      }
      const faseId = fase.id;
      // Fetch matches in this phase
      const { data: partite, error: partitaErr } = await supabase
        .from('partita')
        .select(
          'id, numero_partita, squadra_1_id, squadra_2_id'
        )
        .eq('fase_torneo_id', faseId)
        .order('numero_partita', { ascending: true });
      if (partitaErr || !partite) {
        setMatches([]);
        setLoading(false);
        return;
      }
      // Fetch team names
      const { data: squadre } = await supabase
        .from('squadra')
        .select('id, nome');
      const squadraMap = new Map<number, string>();
      squadre?.forEach((s) => squadraMap.set(s.id, s.nome));
      // For each match, fetch sets to determine winner
      const matchData: MatchData[] = [];
      for (const partita of partite) {
        // Fetch sets
        const { data: sets } = await supabase
          .from('partita_set')
          .select('punteggio_squadra_1, punteggio_squadra_2')
          .eq('partita_id', partita.id);
        let setWins1 = 0;
        let setWins2 = 0;
        sets?.forEach((set) => {
          if (set.punteggio_squadra_1 > set.punteggio_squadra_2) {
            setWins1++;
          } else if (set.punteggio_squadra_2 > set.punteggio_squadra_1) {
            setWins2++;
          }
        });
        let winner: number | null = null;
        if (setWins1 > setWins2) winner = partita.squadra_1_id;
        else if (setWins2 > setWins1) winner = partita.squadra_2_id;
        matchData.push({
          id: partita.id,
          numero_partita: partita.numero_partita,
          squadra_1_id: partita.squadra_1_id,
          squadra_2_id: partita.squadra_2_id,
          squadra_1_nome: squadraMap.get(partita.squadra_1_id) ?? '',
          squadra_2_nome: squadraMap.get(partita.squadra_2_id) ?? '',
          setWins1,
          setWins2,
          winner
        });
      }
      setMatches(matchData);
      setLoading(false);
    }
    fetchMatches();

    const channel = supabase
      .channel(`bracket-live-${faseName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fase_torneo' },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita' },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita_set' },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName]);

  const emptyBracket: MatchData[] = Array.from({ length: 4 }, (_, index) => ({
    id: -1 - index,
    numero_partita: index + 1,
    squadra_1_id: null,
    squadra_2_id: null,
    squadra_1_nome: '',
    squadra_2_nome: '',
    setWins1: 0,
    setWins2: 0,
    winner: null,
    isPlaceholder: true
  }));

  const matchesToRender = matches.length > 0 ? matches : emptyBracket;

  return (
    <div>
      <h2>Fase {faseName}</h2>
      {loading ? (
        <p>Caricamento partite...</p>
      ) : (
        <>
          {matches.length === 0 && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Bracket non ancora popolato: visualizzazione vuota.
            </p>
          )}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {matchesToRender.map((m) => (
            <li
              key={m.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '0.75rem',
                marginBottom: '0.5rem'
              }}
            >
              <div>
                <strong>
                  {m.numero_partita ? `Partita ${m.numero_partita}: ` : ''}
                  {m.squadra_1_nome || 'Da definire'} {m.isPlaceholder ? '-' : m.setWins1} -{' '}
                  {m.isPlaceholder ? '-' : m.setWins2} {m.squadra_2_nome || 'Da definire'}
                </strong>
              </div>
              {m.winner && !m.isPlaceholder && (
                <div>
                  Vincitore: <em>{m.winner === m.squadra_1_id ? m.squadra_1_nome : m.squadra_2_nome}</em>
                </div>
              )}
            </li>
          ))}
          </ul>
        </>
      )}
    </div>
  );
}