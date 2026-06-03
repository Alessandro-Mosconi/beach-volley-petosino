import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';
import Agenda from './components/Agenda';
import Classifica from './components/Classifica';
import Bracket from './components/Bracket';
import TeamStats from './components/TeamStats';
import InfoService from './components/InfoService';

interface Team {
  id: number;
  nome: string;
  orario_pranzo: string | null;
}

type View = 'agenda' | 'classifica' | 'gold' | 'silver' | 'stats' | 'info_service';

function viewFromPath(pathname: string): View {
  switch (pathname) {
    case '/':
    case '/agenda':
      return 'agenda';
    case '/classifica':
      return 'classifica';
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
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [view, setView] = useState<View>(viewFromPath(window.location.pathname));
  const [loading, setLoading] = useState<boolean>(true);
  const [teamsLoadError, setTeamsLoadError] = useState<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setView(viewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
        .select('id, nome, orario_pranzo')
        .order('nome', { ascending: true });
      if (!error && data) {
        const nextTeams = data as Team[];
        setTeams(nextTeams);
        setTeamsLoadError(null);
        setSelectedTeam((currentSelected) => {
          if (nextTeams.length === 0) return null;
          if (currentSelected && nextTeams.some((team) => team.id === currentSelected)) {
            return currentSelected;
          }
          return nextTeams[0].id;
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
      </header>
      {teams.length > 0 && (
        <label className="team-select">
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
      )}
      {/* Navigation */}
      <nav className="tab-nav">
        <button onClick={() => goToView('agenda')} disabled={view === 'agenda'}>
          Agenda
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