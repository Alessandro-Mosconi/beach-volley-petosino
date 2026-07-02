import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './utils/supabase';
import Agenda from './components/Agenda';
import Classifica from './components/Classifica';
import Bracket from './components/Bracket';
import TeamStats from './components/TeamStats';
import InfoService from './components/InfoService';
import MatchesByCourt from './components/MatchesByCourt';
import FinalRanking from './components/FinalRanking';
import Regolamento from './components/Regolamento';

interface Team {
  codice: string;
  nome: string;
  orario_pranzo: string | null;
}

interface Tournament {
  id: number;
  nome: string;
}

type View =
  | 'agenda'
  | 'partite'
  | 'classifica'
  | 'stats'
  | 'regolamento'
  | 'info_service'
  | `phase:${string}`
  | `ranking:${string}`;
type Theme = 'dark' | 'light';

type PhaseKind = 'GIRONE' | 'ELIMINAZIONE_DIRETTA' | 'ALTRO';

interface TournamentPhase {
  codice: string;
  nome: string;
  tipo: PhaseKind;
  ordine: number;
}

interface NavItem {
  view: View;
  label: string;
}

const SELECTED_TEAM_STORAGE_KEY = 'beach-volley:selectedTeam';

function AuthPanel({
  session,
  canEdit,
  onSessionChange
}: {
  session: Session | null;
  canEdit: boolean;
  onSessionChange: (session: Session | null) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage('Accesso non riuscito. Controlla email e password.');
    } else {
      onSessionChange(data.session);
      setEmail('');
      setPassword('');
      setMessage(null);
      setOpen(false);
    }
    setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    onSessionChange(null);
    setBusy(false);
  };

  if (session) {
    return (
      <div className="auth-menu">
        <button
          className={`auth-menu-trigger ${canEdit ? 'auth-menu-trigger-ok' : ''}`}
          type="button"
          onClick={() => setOpen((currentOpen) => !currentOpen)}
        >
          Operatore
        </button>
        {open && (
          <div className="auth-popover auth-popover-active">
            <div>
              <span>Accesso attivo</span>
              <strong>{session.user.email}</strong>
              {!canEdit && <small>Non autorizzato alla modifica</small>}
            </div>
            <button type="button" onClick={signOut} disabled={busy}>
              Esci
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-menu">
      <button className="auth-menu-trigger" type="button" onClick={() => setOpen((currentOpen) => !currentOpen)}>
        Login
      </button>
      {open && (
        <form className="auth-popover" onSubmit={signIn}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={busy}>
            Entra
          </button>
          {message && <small>{message}</small>}
        </form>
      )}
    </div>
  );
}

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

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Tema scuro' : 'Tema chiaro'}
      onClick={onToggle}
    >
      <span className="theme-toggle-icon theme-toggle-sun">
        <ThemeIcon type="light" />
      </span>
      <span className="theme-toggle-icon theme-toggle-moon">
        <ThemeIcon type="dark" />
      </span>
      <span className="theme-toggle-thumb" />
    </button>
  );
}

function viewFromPath(pathname: string): View {
  if (pathname.startsWith('/fase/')) {
    return phaseView(decodeURIComponent(pathname.replace('/fase/', '')));
  }
  if (pathname.startsWith('/classifica-fase/')) {
    return rankingView(decodeURIComponent(pathname.replace('/classifica-fase/', '')));
  }

  switch (pathname) {
    case '/':
    case '/agenda':
      return 'agenda';
    case '/classifica':
      return 'classifica';
    case '/partite':
      return 'partite';
    case '/torneo':
      return phaseView('TORNEO');
    case '/classifica-torneo':
      return rankingView('TORNEO');
    case '/gold':
      return phaseView('GOLD');
    case '/classifica-gold':
      return rankingView('GOLD');
    case '/silver':
      return phaseView('SILVER');
    case '/classifica-silver':
      return rankingView('SILVER');
    case '/stats':
      return 'stats';
    case '/regolamento':
      return 'regolamento';
    case '/info_service':
      return 'info_service';
    default:
      return 'agenda';
  }
}

function pathFromView(view: View): string {
  if (view.startsWith('phase:')) {
    const phaseCode = phaseCodeFromView(view);
    if (phaseCode === 'TORNEO') return '/torneo';
    if (phaseCode === 'GOLD') return '/gold';
    if (phaseCode === 'SILVER') return '/silver';
    return `/fase/${encodeURIComponent(phaseCode ?? '')}`;
  }
  if (view.startsWith('ranking:')) {
    const phaseCode = rankingPhaseFromView(view);
    if (phaseCode === 'TORNEO') return '/classifica-torneo';
    if (phaseCode === 'GOLD') return '/classifica-gold';
    if (phaseCode === 'SILVER') return '/classifica-silver';
    return `/classifica-fase/${encodeURIComponent(phaseCode ?? '')}`;
  }

  switch (view) {
    case 'agenda':
      return '/';
    case 'classifica':
      return '/classifica';
    case 'partite':
      return '/partite';
    case 'stats':
      return '/stats';
    case 'regolamento':
      return '/regolamento';
    case 'info_service':
      return '/info_service';
    default:
      return '/';
  }
}

function phaseView(phaseCode: string): View {
  return `phase:${phaseCode}`;
}

function rankingView(phaseCode: string): View {
  return `ranking:${phaseCode}`;
}

function phaseCodeFromView(view: View) {
  return view.startsWith('phase:') ? view.replace('phase:', '') : null;
}

function rankingPhaseFromView(view: View) {
  return view.startsWith('ranking:') ? view.replace('ranking:', '') : null;
}

function visiblePhaseFromView(view: View) {
  return phaseCodeFromView(view) ?? rankingPhaseFromView(view);
}

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [tournamentPhases, setTournamentPhases] = useState<TournamentPhase[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(() =>
    window.localStorage.getItem(SELECTED_TEAM_STORAGE_KEY)
  );
  const [view, setView] = useState<View>(viewFromPath(window.location.pathname));
  const [loading, setLoading] = useState<boolean>(true);
  const [teamsLoadError, setTeamsLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [canEditResults, setCanEditResults] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [finalRankingReady, setFinalRankingReady] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem('theme');
    return storedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchOperatorPermission() {
      if (!session?.user.email) {
        setCanEditResults(false);
        return;
      }

      const { data, error } = await supabase
        .from('operatore_app')
        .select('email')
        .eq('email', session.user.email)
        .eq('attivo', true)
        .eq('puo_modificare', true)
        .maybeSingle();

      setCanEditResults(!error && Boolean(data));
    }

    fetchOperatorPermission();
  }, [session]);

  useEffect(() => {
    const onPopState = () => {
      setView(viewFromPath(window.location.pathname));
      setNavOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (selectedTeam) {
      window.localStorage.setItem(SELECTED_TEAM_STORAGE_KEY, selectedTeam);
    } else {
      window.localStorage.removeItem(SELECTED_TEAM_STORAGE_KEY);
    }
  }, [selectedTeam]);

  const goToView = (nextView: View) => {
    setView(nextView);
    setNavOpen(false);
    const nextPath = pathFromView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  useEffect(() => {
    if (!session && view === 'info_service') {
      goToView('agenda');
    }
  }, [session, view]);

  useEffect(() => {
    async function fetchFinalRankingReadiness() {
      const rankingPhaseCodes = tournamentPhases
        .filter((phase) => phase.tipo === 'ELIMINAZIONE_DIRETTA')
        .map((phase) => phase.codice);

      if (!activeTournament || rankingPhaseCodes.length === 0) {
        setFinalRankingReady({});
        return;
      }

      const { data, error } = await supabase
        .from('v_partita_risultato')
        .select('fase_torneo_codice, slot_tabellone, squadra_vincitrice_codice, squadra_perdente_codice')
        .eq('torneo_id', activeTournament.id)
        .in('fase_torneo_codice', rankingPhaseCodes)
        .in('slot_tabellone', ['FINALE', 'FINALINA']);

      if (error || !data) {
        setFinalRankingReady({});
        return;
      }

      const isReady = (phase: string) => {
        const phaseMatches = data.filter((match) => match.fase_torneo_codice === phase);
        return ['FINALE', 'FINALINA'].every((slot) =>
          phaseMatches.some(
            (match) =>
              match.slot_tabellone === slot &&
              match.squadra_vincitrice_codice &&
              match.squadra_perdente_codice
          )
        );
      };

      setFinalRankingReady(
        Object.fromEntries(rankingPhaseCodes.map((phaseCode) => [phaseCode, isReady(phaseCode)]))
      );
    }

    fetchFinalRankingReadiness();

    const channel = supabase
      .channel('final-ranking-ready-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchFinalRankingReadiness())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchFinalRankingReadiness())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTournament, tournamentPhases]);

  useEffect(() => {
    const phaseCode = visiblePhaseFromView(view);
    if (!phaseCode) return;

    const phaseExists = tournamentPhases.some((phase) => phase.codice === phaseCode);
    const firstEliminationPhase = tournamentPhases.find((phase) => phase.tipo === 'ELIMINAZIONE_DIRETTA');

    if (!phaseExists && firstEliminationPhase) {
      goToView(phaseView(firstEliminationPhase.codice));
    }
  }, [tournamentPhases, view]);

  const groupPhase = tournamentPhases.find((phase) => phase.tipo === 'GIRONE');
  const directEliminationPhases = tournamentPhases.filter((phase) => phase.tipo === 'ELIMINAZIONE_DIRETTA');
  const visibleNavItems: NavItem[] = [
    { view: 'agenda', label: 'Agenda' },
    { view: 'partite', label: 'Partite' },
    ...(groupPhase ? [{ view: 'classifica' as View, label: groupPhase.nome }] : []),
    ...directEliminationPhases.map((phase) => ({ view: phaseView(phase.codice), label: phase.nome })),
    ...directEliminationPhases
      .filter((phase) => finalRankingReady[phase.codice])
      .map((phase) => ({ view: rankingView(phase.codice), label: `Classifica ${phase.nome}` })),
    { view: 'stats', label: 'Statistiche Squadra' },
    { view: 'regolamento', label: 'Regolamento' },
    ...(session ? [{ view: 'info_service' as View, label: 'Info Service' }] : [])
  ];

  useEffect(() => {
    async function fetchTournamentAndTeams() {
      const { data: tournament, error: tournamentError } = await supabase
        .from('torneo')
        .select('id, nome')
        .eq('visibile', true)
        .maybeSingle();

      if (tournamentError || !tournament) {
        setActiveTournament(null);
        setTournamentPhases([]);
        setTeams([]);
        setTeamsLoadError(tournamentError ? 'Errore nel caricamento del torneo attivo' : null);
        setLoading(false);
        return;
      }

      setActiveTournament(tournament as Tournament);

      const [teamsResult, phasesResult] = await Promise.all([
        supabase
          .from('squadra')
          .select('codice, nome, orario_pranzo')
          .eq('torneo_id', tournament.id)
          .order('nome', { ascending: true }),
        supabase
          .from('v_torneo_fase')
          .select('codice, nome, tipo, ordine')
          .eq('torneo_id', tournament.id)
          .order('ordine', { ascending: true })
      ]);

      const { data: teamsData, error } = teamsResult;
      const { data: phasesData, error: phasesError } = phasesResult;

      if (!phasesError && phasesData) {
        setTournamentPhases(phasesData as TournamentPhase[]);
      } else {
        setTournamentPhases([]);
        setTeamsLoadError(phasesError?.message ?? 'Errore nel caricamento delle fasi torneo');
      }

      if (!error && teamsData) {
        const nextTeams = teamsData as Team[];
        setTeams(nextTeams);
        if (!phasesError) {
          setTeamsLoadError(null);
        }
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
    fetchTournamentAndTeams();

    const channel = supabase
      .channel('app-tournament-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'torneo' },
        () => fetchTournamentAndTeams()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchTournamentAndTeams()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'torneo_fase' },
        () => fetchTournamentAndTeams()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <p>Caricamento squadre in corso...</p>;
  }

  if (!activeTournament) {
    return (
      <div className="app-shell">
        <div className="section-panel">
          <p>{teamsLoadError ?? 'Nessun torneo attivo al momento'}</p>
        </div>
      </div>
    );
  }

  const currentBracketPhase = phaseCodeFromView(view);
  const currentRankingPhase = rankingPhaseFromView(view);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          <span>Torneo Beach Volley</span>
          <h1>{activeTournament.nome}</h1>
        </div>
        <nav className="desktop-tab-nav" aria-label="Navigazione principale">
          {visibleNavItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={view === item.view ? 'active' : ''}
              aria-current={view === item.view ? 'page' : undefined}
              onClick={() => goToView(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <div className="desktop-auth">
            <AuthPanel session={session} canEdit={canEditResults} onSessionChange={setSession} />
          </div>
          <div className="desktop-theme-toggle">
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
          <nav className="mobile-nav-menu" aria-label="Navigazione principale mobile">
            <button
              className="nav-menu-trigger"
              type="button"
              aria-label="Apri menu"
              aria-expanded={navOpen}
              aria-controls="main-navigation-menu"
              onClick={() => setNavOpen((currentOpen) => !currentOpen)}
            >
              <span className="hamburger-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            {navOpen && (
              <div id="main-navigation-menu" className="nav-menu-popover">
                <div className="mobile-nav-links">
                  {visibleNavItems.map((item) => (
                    <button
                      key={item.view}
                      type="button"
                      className={view === item.view ? 'active' : ''}
                      aria-current={view === item.view ? 'page' : undefined}
                      onClick={() => goToView(item.view)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mobile-theme-toggle">
                  <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                </div>
                <div className="mobile-nav-auth">
                  <AuthPanel session={session} canEdit={canEditResults} onSessionChange={setSession} />
                </div>
              </div>
            )}
          </nav>
        </div>
      </header>
      {/* Render chosen view */}
      <div className="section-panel">
        {teams.length === 0 && view !== 'info_service' && (
          <p>
            Nessuna squadra disponibile.
            {teamsLoadError ? ` Errore Supabase: ${teamsLoadError}` : ''}
          </p>
        )}
        {view === 'agenda' && selectedTeam && (
          <Agenda
            teamId={selectedTeam}
            teams={teams}
            tournamentId={activeTournament.id}
            onTeamChange={setSelectedTeam}
          />
        )}
        {view === 'classifica' && <Classifica faseName="GIRONI" tournamentId={activeTournament.id} />}
        {view === 'partite' && <MatchesByCourt tournamentId={activeTournament.id} canEdit={canEditResults} />}
        {currentBracketPhase && (
          <Bracket faseName={currentBracketPhase} tournamentId={activeTournament.id} canEdit={canEditResults} />
        )}
        {currentRankingPhase && <FinalRanking faseName={currentRankingPhase} tournamentId={activeTournament.id} />}
        {view === 'stats' && selectedTeam && (
          <TeamStats
            teamId={selectedTeam}
            teams={teams}
            tournamentId={activeTournament.id}
            onTeamChange={setSelectedTeam}
          />
        )}
        {view === 'regolamento' && <Regolamento tournamentId={activeTournament.id} canEdit={canEditResults} />}
        {view === 'info_service' && <InfoService />}
      </div>
    </div>
  );
}
