import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface BracketProps {
  faseName: string; // 'GOLD' or 'SILVER'
}

interface MatchData {
  id: number;
  numero_partita: number;
  squadra_1_id: number | null;
  squadra_2_id: number | null;
  squadra_1_nome: string;
  squadra_2_nome: string;
  setWins1: number;
  setWins2: number;
  winner: number | null;
  orario_inizio: string | null;
  campo_nome: string;
}

const BRACKET_STRUCTURE = [
  { title: 'Quarti', matchNumbers: [1, 2, 3, 4] },
  { title: 'Semifinali', matchNumbers: [5, 6] },
  { title: 'Finale', matchNumbers: [7] }
];

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
        .select('id, numero_partita, squadra_1_id, squadra_2_id, orario_inizio, campo_id')
        .eq('fase_torneo_id', faseId)
        .order('numero_partita', { ascending: true });
      if (partitaErr || !partite) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const [squadreRes, campiRes] = await Promise.all([
        supabase.from('squadra').select('id, nome'),
        supabase.from('campo').select('id, nome')
      ]);

      const squadre = squadreRes.data;
      const campi = campiRes.data;
      const squadraMap = new Map<number, string>();
      squadre?.forEach((s) => squadraMap.set(s.id, s.nome));

      const campoMap = new Map<number, string>();
      campi?.forEach((c) => campoMap.set(c.id, c.nome));

      const partitaIds = partite.map((p) => p.id);
      const { data: allSets } = await supabase
        .from('partita_set')
        .select('partita_id, punteggio_squadra_1, punteggio_squadra_2')
        .in('partita_id', partitaIds);

      const setsByMatch = new Map<number, { punteggio_squadra_1: number; punteggio_squadra_2: number }[]>();
      allSets?.forEach((set) => {
        const list = setsByMatch.get(set.partita_id) ?? [];
        list.push(set);
        setsByMatch.set(set.partita_id, list);
      });

      const matchData: MatchData[] = [];
      for (const partita of partite) {
        const sets = setsByMatch.get(partita.id) ?? [];
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
          numero_partita: partita.numero_partita ?? 0,
          squadra_1_id: partita.squadra_1_id,
          squadra_2_id: partita.squadra_2_id,
          squadra_1_nome: squadraMap.get(partita.squadra_1_id) ?? '',
          squadra_2_nome: squadraMap.get(partita.squadra_2_id) ?? '',
          setWins1,
          setWins2,
          winner,
          orario_inizio: partita.orario_inizio ?? null,
          campo_nome: campoMap.get(partita.campo_id) ?? ''
        });
      }

      setMatches(matchData.filter((m) => m.numero_partita > 0));
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campo' },
        () => fetchMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName]);

  const emptyBracket: MatchData[] = Array.from({ length: 7 }, (_, index) => ({
    id: -100 - index,
    numero_partita: index + 1,
    squadra_1_id: null,
    squadra_2_id: null,
    squadra_1_nome: '',
    squadra_2_nome: '',
    setWins1: 0,
    setWins2: 0,
    winner: null,
    orario_inizio: null,
    campo_nome: ''
  }));

  const matchesByNumber = new Map<number, MatchData>();
  (matches.length > 0 ? matches : emptyBracket).forEach((match) => {
    matchesByNumber.set(match.numero_partita, match);
  });

  const findWinnerFallback = (matchNumber: number) => {
    if (matchNumber === 5) return ['Vincente Quarto 1', 'Vincente Quarto 2'];
    if (matchNumber === 6) return ['Vincente Quarto 3', 'Vincente Quarto 4'];
    if (matchNumber === 7) return ['Vincente Semifinale 1', 'Vincente Semifinale 2'];
    return ['Da definire', 'Da definire'];
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Orario da definire';
    return new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  };

  return (
    <div>
      <h2>Fase {faseName}</h2>
      {loading ? (
        <p>Caricamento partite...</p>
      ) : (
        <>
          {matches.length === 0 && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Nessuna squadra ancora assegnata: bracket vuoto visibile.
            </p>
          )}
          <div className="bracket-tree">
            {BRACKET_STRUCTURE.map((round) => (
              <div key={round.title} className="bracket-round">
                <h3>{round.title}</h3>
                {round.matchNumbers.map((matchNumber) => {
                  const match = matchesByNumber.get(matchNumber) ?? emptyBracket[matchNumber - 1];
                  const [fallbackA, fallbackB] = findWinnerFallback(matchNumber);
                  const teamA = match.squadra_1_nome || fallbackA;
                  const teamB = match.squadra_2_nome || fallbackB;
                  const showScore = Boolean(match.squadra_1_nome && match.squadra_2_nome);
                  return (
                    <div key={matchNumber} className="bracket-match-card">
                      <div>
                        <strong>Partita {matchNumber}</strong>
                      </div>
                      <div className="bracket-meta">{formatDateTime(match.orario_inizio)}</div>
                      <div className="bracket-meta">
                        {match.campo_nome ? `Campo: ${match.campo_nome}` : 'Campo da definire'}
                      </div>
                      <div className="bracket-team-line">
                        {teamA} {showScore ? match.setWins1 : '-'}
                      </div>
                      <div className="bracket-team-line">
                        {teamB} {showScore ? match.setWins2 : '-'}
                      </div>
                      <div className="bracket-meta">
                        Risultato: {showScore ? `${match.setWins1}-${match.setWins2}` : 'in attesa'}
                      </div>
                      {match.winner && (
                        <div className="bracket-winner">
                          Vincente:{' '}
                          <em>{match.winner === match.squadra_1_id ? match.squadra_1_nome : match.squadra_2_nome}</em>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}