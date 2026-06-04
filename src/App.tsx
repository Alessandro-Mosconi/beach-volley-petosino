import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';
import Agenda from './components/Agenda';
import Classifica from './components/Classifica';
import Bracket from './components/Bracket';
import TeamStats from './components/TeamStats';
import InfoService from './components/InfoService';
import MatchesByCourt from './components/MatchesByCourt';

interface Team {
  codice: string;
  nome: string;
  orario_pranzo: string | null;
}

type View = 'agenda' | 'partite' | 'classifica' | 'gold' | 'silver' | 'stats' | 'info_service';
type Theme = 'dark' | 'light';

function ThemeIcon({ type }: { type: Theme }) {
  if (type === 'light') {
    return (
      <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }

  return (
    <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 14.6A8 8 0 0 1 9.4 3a7 7 0 1 0 11.6 11.6z" />
    </svg>
  );
}

function viewFromPath(pathname: string): View {
  switch (pathname) {
    case '/':
    case '/agenda':
      return 'agenda';
    case '/classifica':
      return 'classifica';
    case '/partite':
      return 'partite';
    case '/gold':
      return 'gold';
    case '/silver':
      return 'silver';
    case '/stats':
      return 'stats';
    case '/info_service':
      return 'info_service';
    default:
      return 'agenda';
  }
}

function pathFromView(view: View): string {
  switch (view) {
    case 'agenda':
      return '/';
    case 'classifica':
      return '/classifica';
    case 'partite':
      return '/partite';
    case 'gold':
      return '/gold';
    case 'silver':
      return '/silver';
    case 'stats':
      return '/stats';
    case 'info_service':
      return '/info_service';
    default:
      return '/';
  }
}

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromPath(window.location.pathname));
  const [loading, setLoading] = useState<boolean>(true);
  const [teamsLoadError, setTeamsLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem('theme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const onPopState = () => {
      setView(viewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const goToView = (nextView: View) => {
    setView(nextView);
    const nextPath = pathFromView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  // Load all teams on mount
  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase
        .from('squadra')
        .select('codice, nome, orario_pranzo')
        .order('nome', { ascending: true });
      if (!error && data) {
        const nextTeams = data as Team[];
        setTeams(nextTeams);
        setTeamsLoadError(null);
        setSelectedTeam((currentSelected) => {
          if (nextTeams.length === 0) return null;
          if (currentSelected && nextTeams.some((team) => team.codice === currentSelected)) {
            return currentSelected;
          }
          return nextTeams[0].codice;
        });
      } else {
        setTeamsLoadError(error?.message ?? 'Errore sconosciuto');
      }
      setLoading(false);
    }
    fetchTeams();

    const channel = supabase
      .channel('teams-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchTeams()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <p>Caricamento squadre in corso...</p>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Torneo Beach Volley</h1>
        <button
          className="theme-toggle"
          type="button"
          aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? 'Tema scuro' : 'Tema chiaro'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span className="theme-toggle-icon theme-toggle-sun">
            <ThemeIcon type="light" />
          </span>
          <span className="theme-toggle-icon theme-toggle-moon">
            <ThemeIcon type="dark" />
          </span>
          <span className="theme-toggle-thumb" />
        </button>
      </header>
      {teams.length > 0 && (
        <label className="team-select">
          Seleziona squadra:{' '}
          <select
            value={selectedTeam ?? undefined}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team.codice} value={team.codice}>
                {team.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* Navigation */}
      <nav className="tab-nav">
        <button onClick={() => goToView('agenda')} disabled={view === 'agenda'}>
          Agenda
        </button>
        <button onClick={() => goToView('partite')} disabled={view === 'partite'}>
          Partite
        </button>
        <button onClick={() => goToView('classifica')} disabled={view === 'classifica'}>
          Classifiche Gironi
        </button>
        <button onClick={() => goToView('gold')} disabled={view === 'gold'}>
          Gold
        </button>
        <button onClick={() => goToView('silver')} disabled={view === 'silver'}>
          Silver
        </button>
        <button onClick={() => goToView('stats')} disabled={view === 'stats'}>
          Statistiche Squadra
        </button>
      </nav>
      {/* Render chosen view */}
      <div className="section-panel">
        {teams.length === 0 && view !== 'info_service' && (
          <p>
            Nessuna squadra disponibile.
            {teamsLoadError ? ` Errore Supabase: ${teamsLoadError}` : ''}
          </p>
        )}
        {view === 'agenda' && selectedTeam && (
          <Agenda teamId={selectedTeam} teams={teams} />
        )}
        {view === 'classifica' && <Classifica faseName="GIRONI" />}
        {view === 'partite' && <MatchesByCourt />}
        {view === 'gold' && <Bracket faseName="GOLD" />}
        {view === 'silver' && <Bracket faseName="SILVER" />}
        {view === 'stats' && selectedTeam && (
          <TeamStats teamId={selectedTeam} teams={teams} />
        )}
        {view === 'info_service' && <InfoService />}
      </div>
    </div>
  );
}
