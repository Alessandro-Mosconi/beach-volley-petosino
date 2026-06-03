import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';
import Agenda from './components/Agenda';
import Classifica from './components/Classifica';
import Bracket from './components/Bracket';
import TeamStats from './components/TeamStats';

interface Team {
  id: number;
  nome: string;
  orario_pranzo: string | null;
}

type View = 'agenda' | 'classifica' | 'gold' | 'silver' | 'stats';

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [view, setView] = useState<View>('agenda');
  const [loading, setLoading] = useState<boolean>(true);

  // Load all teams on mount
  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase
        .from('squadra')
        .select('id, nome, orario_pranzo')
        .order('nome', { ascending: true });
      if (!error && data) {
        setTeams(data as Team[]);
        if (data.length > 0) setSelectedTeam(data[0].id);
      }
      setLoading(false);
    }
    fetchTeams();
  }, []);

  if (loading) {
    return <p>Caricamento squadre in corso...</p>;
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Torneo Beach Volley</h1>
      {teams.length === 0 ? (
        <p>Nessuna squadra trovata.</p>
      ) : (
        <>
          <label>
            Seleziona squadra:{' '}
            <select
              value={selectedTeam ?? undefined}
              onChange={(e) => setSelectedTeam(Number(e.target.value))}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.nome}
                </option>
              ))}
            </select>
          </label>
          {/* Navigation */}
          <nav style={{ marginTop: '1rem' }}>
            <button onClick={() => setView('agenda')} disabled={view === 'agenda'}>
              Agenda
            </button>{' '}
            <button onClick={() => setView('classifica')} disabled={view === 'classifica'}>
              Classifiche Gironi
            </button>{' '}
            <button onClick={() => setView('gold')} disabled={view === 'gold'}>
              Gold
            </button>{' '}
            <button onClick={() => setView('silver')} disabled={view === 'silver'}>
              Silver
            </button>{' '}
            <button onClick={() => setView('stats')} disabled={view === 'stats'}>
              Statistiche Squadra
            </button>
          </nav>
          {/* Render chosen view */}
          <div style={{ marginTop: '1.5rem' }}>
            {view === 'agenda' && selectedTeam && (
              <Agenda teamId={selectedTeam} teams={teams} />
            )}
            {view === 'classifica' && <Classifica faseName="GIRONI" />}
            {view === 'gold' && <Bracket faseName="GOLD" />}
            {view === 'silver' && <Bracket faseName="SILVER" />}
            {view === 'stats' && selectedTeam && (
              <TeamStats teamId={selectedTeam} teams={teams} />
            )}
          </div>
        </>
      )}
    </div>
  );
}