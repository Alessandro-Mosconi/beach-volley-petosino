import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface Team {
  codice: string;
  nome: string;
  orario_pranzo: string | null;
}

interface MatchEvent {
  id: string;
  orario_inizio: string;
  campo: string;
  detail: string;
  partita_id?: number;
  team1?: string;
  team2?: string;
  team1Code?: string;
  team2Code?: string;
  setWins1?: number;
  setWins2?: number;
  role: 'player' | 'referee' | 'lunch';
  status: string;
}

type IconName = 'ball' | 'clipboard' | 'utensils' | 'mapPin' | 'pulse';

function AgendaIcon({ name }: { name: IconName }) {
  const commonProps = {
    className: 'agenda-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };

  if (name === 'ball') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M5.7 6.1c3.6.4 6.5 3.3 6.9 6.9" />
        <path d="M18.3 17.9c-3.6-.4-6.5-3.3-6.9-6.9" />
        <path d="M14.8 3.6c-1.3 2.9-4 5-7.2 5.4" />
        <path d="M9.2 20.4c1.3-2.9 4-5 7.2-5.4" />
      </svg>
    );
  }

  if (name === 'clipboard') {
    return (
      <svg {...commonProps}>
        <path d="M9 4h6" />
        <path d="M10 2h4v4h-4z" />
        <path d="M7 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }

  if (name === 'utensils') {
    return (
      <svg {...commonProps}>
        <path d="M4 3v7" />
        <path d="M7 3v7" />
        <path d="M5.5 10v11" />
        <path d="M12 3v18" />
        <path d="M12 3c4 1.5 5 5 3 8h-3" />
      </svg>
    );
  }

  if (name === 'mapPin') {
    return (
      <svg {...commonProps}>
        <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 12h4l2-5 4 10 2-5h4" />
    </svg>
  );
}

const EVENT_META = {
  player: {
    label: 'Partita',
    eyebrow: 'Da giocare',
    title: 'Match in campo',
    icon: 'ball' as const
  },
  referee: {
    label: 'Arbitraggio',
    eyebrow: 'Turno arbitro',
    title: 'Arbitri questa partita',
    icon: 'clipboard' as const
  },
  lunch: {
    label: 'Pranzo',
    eyebrow: 'Pausa',
    title: 'Pausa pranzo',
    icon: 'utensils' as const
  }
};

interface AgendaProps {
  teamId: string;
  teams: Team[];
  tournamentId: number;
  onTeamChange: (teamId: string) => void;
}

export default function Agenda({ teamId, teams, tournamentId, onTeamChange }: AgendaProps) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const team = teams.find((t) => t.codice === teamId);
  const lunchTime = team?.orario_pranzo ?? null;

  useEffect(() => {
    async function fetchAgenda() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_agenda_squadra')
        .select(
          'tipo_evento, partita_id, squadra_codice, campo_nome, orario_inizio, squadra_1_nome, squadra_2_nome, squadra_avversaria_nome, stato, torneo_id'
        )
        .eq('torneo_id', tournamentId)
        .eq('squadra_codice', teamId)
        .order('orario_inizio', { ascending: true });

      if (error || !data) {
        setEvents([]);
        setLoadError(error?.message ?? 'Risposta agenda vuota o non valida');
        setLoading(false);
        return;
      }

      const matchIds = Array.from(
        new Set(
          data
            .map((eventRow) => eventRow.partita_id)
            .filter((partitaId): partitaId is number => typeof partitaId === 'number')
        )
      );
      const resultsByMatch = new Map<number, { setWins1: number; setWins2: number }>();

      if (matchIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('v_partita_risultato')
          .select('partita_id, set_vinti_squadra_1, set_vinti_squadra_2')
          .in('partita_id', matchIds);

        resultsData?.forEach((resultRow) => {
          resultsByMatch.set(resultRow.partita_id, {
            setWins1: resultRow.set_vinti_squadra_1 ?? 0,
            setWins2: resultRow.set_vinti_squadra_2 ?? 0
          });
        });
      }

      const eventsList: MatchEvent[] = data.map((eventRow) => {
        if (eventRow.tipo_evento === 'PRANZO') {
          return {
            id: `lunch-${eventRow.squadra_codice}`,
            orario_inizio: eventRow.orario_inizio,
            campo: '',
            detail: 'Pausa pranzo',
            role: 'lunch',
            status: eventRow.stato ?? 'programmata'
          };
        }

        const isReferee = eventRow.tipo_evento === 'ARBITRAGGIO';
        const matchup =
          eventRow.squadra_1_nome && eventRow.squadra_2_nome
            ? `${eventRow.squadra_1_nome} vs ${eventRow.squadra_2_nome}`
            : eventRow.squadra_avversaria_nome ?? 'Partita';
        const result = eventRow.partita_id ? resultsByMatch.get(eventRow.partita_id) : undefined;

        return {
          id: `${eventRow.tipo_evento}-${eventRow.partita_id}`,
          partita_id: eventRow.partita_id,
          orario_inizio: eventRow.orario_inizio,
          campo: eventRow.campo_nome ?? '',
          detail: matchup,
          team1Code: eventRow.squadra_1_codice ?? undefined,
          team1: eventRow.squadra_1_nome ?? undefined,
          team2Code: eventRow.squadra_2_codice ?? undefined,
          team2: eventRow.squadra_2_nome ?? undefined,
          setWins1: result?.setWins1 ?? 0,
          setWins2: result?.setWins2 ?? 0,
          role: isReferee ? 'referee' : 'player',
          status: eventRow.stato ?? ''
        };
      });
      setEvents(eventsList);
      setLoadError(null);
      setLoading(false);
    }
    fetchAgenda();

    const channel = supabase
      .channel(`agenda-live-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partita_set' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campo' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squadra' },
        () => fetchAgenda()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'torneo' },
        () => fetchAgenda()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, tournamentId]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  };

  const eventDays = new Set(events.map((event) => formatDate(event.orario_inizio)));
  const hasMultipleEventDays = eventDays.size > 1;

  const shouldShowStatus = (event: MatchEvent) =>
    event.role !== 'lunch' && event.status.trim().toLowerCase() !== 'programmata';

  const getTeamClassName = (event: MatchEvent, side: 'team1' | 'team2') => {
    const setWins1 = event.setWins1 ?? 0;
    const setWins2 = event.setWins2 ?? 0;
    if (setWins1 + setWins2 === 0) return undefined;
    if (setWins1 === setWins2) return 'agenda-match-team-draw';
    if (side === 'team1' && setWins1 > setWins2) return 'agenda-match-team-winner';
    if (side === 'team2' && setWins2 > setWins1) return 'agenda-match-team-winner';
    return undefined;
  };

  const renderEventTitle = (event: MatchEvent) => {
    if (event.team1 && event.team2) {
      return (
        <span className="agenda-match-title">
          <span className={getTeamClassName(event, 'team1')}>{event.team1}</span>
          <small>vs</small>
          <span className={getTeamClassName(event, 'team2')}>{event.team2}</span>
        </span>
      );
    }

    return event.detail;
  };

  return (
    <div className="agenda-view">
      <div className="agenda-heading">
        <div>
          <h2>Agenda giornaliera</h2>
        </div>
        <div className="agenda-heading-actions">
          <label className="team-select agenda-team-select">
            Squadra
            <select
              value={teamId}
              onChange={(event) => onTeamChange(event.target.value)}
            >
              {teams.map((teamOption) => (
                <option key={teamOption.codice} value={teamOption.codice}>
                  {teamOption.nome}
                </option>
              ))}
            </select>
          </label>
          {lunchTime && (
            <div className="agenda-lunch-summary">
              <span><AgendaIcon name="utensils" /> Pranzo</span>
              <strong>{lunchTime.slice(0, 5)}</strong>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="agenda-loading" aria-live="polite" aria-busy="true">
          <div className="agenda-spinner" />
          <div>
            <strong>Caricamento agenda</strong>
            <span>Sto sincronizzando gli impegni live...</span>
          </div>
          <div className="agenda-skeleton-list">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : events.length === 0 ? (
        <p className="agenda-empty">
          Nessun impegno trovato in v_agenda_squadra per la squadra selezionata.
          {loadError ? ` Errore Supabase: ${loadError}` : ''}
        </p>
      ) : (
        <ol className="agenda-timeline">
          {events.map((e) => (
            <li
              key={e.id}
              className={`agenda-event-card agenda-event-card-${e.role}`}
            >
              <div className="agenda-time-block">
                <strong>{formatTime(e.orario_inizio)}</strong>
                {(e.role !== 'lunch' || hasMultipleEventDays) && <span>{formatDate(e.orario_inizio)}</span>}
              </div>
              <div className="agenda-event-body">
                <div className="agenda-event-header">
                  <div className="agenda-event-toprow">
                    <span className={`agenda-event-badge agenda-event-badge-${e.role}`}>
                      <AgendaIcon name={EVENT_META[e.role].icon} />
                      {EVENT_META[e.role].label}
                    </span>
                    {shouldShowStatus(e) && (
                      <span className="agenda-status"><AgendaIcon name="pulse" />{e.status}</span>
                    )}
                  </div>
                  <h3>{renderEventTitle(e)}</h3>
                </div>
                <div className="agenda-event-meta">
                  {e.campo && <span><AgendaIcon name="mapPin" />{e.campo}</span>}
                  {e.role !== 'lunch' && (e.setWins1 ?? 0) + (e.setWins2 ?? 0) > 0 && (
                    <span>Set {e.setWins1} / {e.setWins2}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
