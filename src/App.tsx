import { useEffect, useState } from 'react';
import './App.css';
import './App.css';
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
  // theme state for light/dark mode. default to light theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('beach-volley-theme');
      return saved === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

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

  // apply theme to document body whenever it changes
  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    // persist theme selection
    localStorage.setItem('beach-volley-theme', theme);
  }, [theme]);

  if (loading) {
    return <p>Caricamento squadre in corso...</p>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Torneo Beach Volley</h1>
        {/* Theme toggle */}
        <label className="theme-toggle">
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
          <span>{theme === 'dark' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
        </label>
      </header>
      {teams.length === 0 ? (
        <p>Nessuna squadra trovata.</p>
      ) : (
        <div className="content">
          <div className="sidebar">
            <label>
              Squadra
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
            <nav className="navigation">
              <button onClick={() => setView('agenda')} className={view === 'agenda' ? 'active' : ''}>
                Agenda
              </button>
              <button onClick={() => setView('classifica')} className={view === 'classifica' ? 'active' : ''}>
                Gironi
              </button>
              <button onClick={() => setView('gold')} className={view === 'gold' ? 'active' : ''}>
                Gold
              </button>
              <button onClick={() => setView('silver')} className={view === 'silver' ? 'active' : ''}>
                Silver
              </button>
              <button onClick={() => setView('stats')} className={view === 'stats' ? 'active' : ''}>
                Statistiche
              </button>
            </nav>
          </div>
          <main className="view-container">
            {view === 'agenda' && selectedTeam && <Agenda teamId={selectedTeam} teams={teams} />}
            {view === 'classifica' && <Classifica faseName="GIRONI" />}
            {view === 'gold' && <Bracket faseName="GOLD" />}
            {view === 'silver' && <Bracket faseName="SILVER" />}
            {view === 'stats' && selectedTeam && <TeamStats teamId={selectedTeam} teams={teams} />}
          </main>
        </div>
      )}
    </div>
  );
}