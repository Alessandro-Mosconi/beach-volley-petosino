import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface FinalRankingProps {
  faseName: 'GOLD' | 'SILVER';
  tournamentId: number;
}

interface FinalMatch {
  slot_tabellone: string | null;
  squadra_vincitrice_nome: string | null;
  squadra_perdente_nome: string | null;
  stato: string | null;
}

interface RankingRow {
  position: number;
  teamName: string;
  source: string;
}

function buildRanking(matches: FinalMatch[]): RankingRow[] | null {
  const finalMatch = matches.find((match) => match.slot_tabellone === 'FINALE');
  const thirdPlaceMatch = matches.find((match) => match.slot_tabellone === 'FINALINA');

  if (
    !finalMatch ||
    finalMatch.stato !== 'terminata' ||
    !finalMatch?.squadra_vincitrice_nome ||
    !finalMatch.squadra_perdente_nome ||
    !thirdPlaceMatch ||
    thirdPlaceMatch.stato !== 'terminata' ||
    !thirdPlaceMatch?.squadra_vincitrice_nome ||
    !thirdPlaceMatch.squadra_perdente_nome
  ) {
    return null;
  }

  return [
    { position: 1, teamName: finalMatch.squadra_vincitrice_nome, source: 'Vincente finale' },
    { position: 2, teamName: finalMatch.squadra_perdente_nome, source: 'Finalista' },
    { position: 3, teamName: thirdPlaceMatch.squadra_vincitrice_nome, source: 'Vincente finalina' },
    { position: 4, teamName: thirdPlaceMatch.squadra_perdente_nome, source: 'Quarto posto' }
  ];
}

export default function FinalRanking({ faseName, tournamentId }: FinalRankingProps) {
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_partita_risultato')
        .select('slot_tabellone, squadra_vincitrice_nome, squadra_perdente_nome, stato')
        .eq('torneo_id', tournamentId)
        .eq('fase_torneo_codice', faseName)
        .in('slot_tabellone', ['FINALE', 'FINALINA']);

      setRanking(error || !data ? null : buildRanking(data as FinalMatch[]));
      setLoading(false);
    }

    fetchRanking();

    const channel = supabase
      .channel(`final-ranking-${faseName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchRanking())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchRanking())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName, tournamentId]);

  return (
    <div className="final-ranking-view">
      <h2>Classifica {faseName}</h2>
      {loading ? (
        <p>Caricamento classifica...</p>
      ) : !ranking ? (
        <p className="agenda-empty">Classifica disponibile quando finale e finalina sono terminate.</p>
      ) : (
        <ol className="final-ranking-list">
          {ranking.map((row) => (
            <li key={row.position} className={`final-ranking-row final-ranking-row-${row.position}`}>
              <span className="final-ranking-position">{row.position}</span>
              <strong>{row.teamName}</strong>
              <span>{row.source}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
