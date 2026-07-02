import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface FinalRankingProps {
  faseName: string;
  tournamentId: number;
}

interface FinalRankingRow {
  posizione: number;
  squadra_nome: string;
}

function positionLabel(position: number) {
  switch (position) {
    case 1:
      return 'Primo posto';
    case 2:
      return 'Secondo posto';
    case 3:
      return 'Terzo posto';
    default:
      return 'Quarto posto';
  }
}

export default function FinalRanking({ faseName, tournamentId }: FinalRankingProps) {
  const [ranking, setRanking] = useState<FinalRankingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const phaseClass = faseName.toLowerCase();

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_classifica_finale')
        .select('posizione, squadra_nome')
        .eq('torneo_id', tournamentId)
        .eq('fase_torneo_codice', faseName)
        .order('posizione', { ascending: true });

      setRanking(error || !data || data.length === 0 ? null : (data as FinalRankingRow[]));
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
    <div className={`final-ranking-view final-ranking-view-${phaseClass}`}>
      <div className="final-ranking-hero">
        <h2>Classifica finale {faseName}</h2>
      </div>
      {loading ? (
        <p className="final-ranking-status">Caricamento classifica...</p>
      ) : !ranking ? (
        <p className="final-ranking-status">Classifica disponibile quando finale e finalina hanno un vincitore.</p>
      ) : (
        <>
          <ol className="final-ranking-list">
            {ranking.map((row) => (
              <li key={row.posizione} className={`final-ranking-row final-ranking-row-${row.posizione}`}>
                <span className="final-ranking-position">
                  <span>{row.posizione}</span>
                </span>
                <div className="final-ranking-team">
                  <strong>{row.squadra_nome}</strong>
                  <small>{positionLabel(row.posizione)}</small>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
