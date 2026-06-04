import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface FinalRankingProps {
  faseName: 'GOLD' | 'SILVER';
  tournamentId: number;
}

interface FinalRankingRow {
  posizione: number;
  squadra_nome: string;
  descrizione: string;
}

export default function FinalRanking({ faseName, tournamentId }: FinalRankingProps) {
  const [ranking, setRanking] = useState<FinalRankingRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_classifica_finale')
        .select('posizione, squadra_nome, descrizione')
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
    <div className="final-ranking-view">
      <h2>Classifica {faseName}</h2>
      {loading ? (
        <p>Caricamento classifica...</p>
      ) : !ranking ? (
        <p className="agenda-empty">Classifica disponibile quando finale e finalina sono terminate.</p>
      ) : (
        <ol className="final-ranking-list">
          {ranking.map((row) => (
            <li key={row.posizione} className={`final-ranking-row final-ranking-row-${row.posizione}`}>
              <span className="final-ranking-position">{row.posizione}</span>
              <strong>{row.squadra_nome}</strong>
              <span>{row.descrizione}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
