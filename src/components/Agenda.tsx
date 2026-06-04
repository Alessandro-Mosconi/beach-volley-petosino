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
  opponent: string;
  role: 'player' | 'referee' | 'lunch';
  matchNumber: number | null;
  status: string;
}

type IconName = 'ball' | 'clipboard' | 'utensils' | 'mapPin' | 'hash' | 'pulse';

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

  if (name === 'hash') {
    return (
      <svg {...commonProps}>
        <path d="M5 9h14" />
        <path d="M4 15h14" />
        <path d="M10 3 8 21" />
        <path d="M16 3l-2 18" />
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
}

export default function Agenda({ teamId, teams }: AgendaProps) {
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
          'tipo_evento, partita_id, numero_partita, squadra_codice, campo_nome, orario_inizio, squadra_1_nome, squadra_2_nome, squadra_avversaria_nome, stato'
        )
        .eq('squadra_codice', teamId)
        .order('orario_inizio', { ascending: true });

      if (error || !data) {
        setEvents([]);
        setLoadError(error?.message ?? 'Risposta agenda vuota o non valida');
        setLoading(false);
        return;
      }

      const eventsList: MatchEvent[] = data.map((eventRow) => {
        if (eventRow.tipo_evento === 'PRANZO') {
          return {
            id: `lunch-${eventRow.squadra_codice}`,
            orario_inizio: eventRow.orario_inizio,
            campo: '',
            opponent: 'Pausa programmata',
            role: 'lunch',
            matchNumber: null,
            status: eventRow.stato ?? 'programmata'
          };
        }

        const isReferee = eventRow.tipo_evento === 'ARBITRAGGIO';
        const opponentName = isReferee
          ? `${eventRow.squadra_1_nome ?? ''} vs ${eventRow.squadra_2_nome ?? ''}`
          : eventRow.squadra_avversaria_nome ?? '';

        return {
          id: `${eventRow.tipo_evento}-${eventRow.partita_id}`,
          orario_inizio: eventRow.orario_inizio,
          campo: eventRow.campo_nome ?? '',
          opponent: opponentName,
          role: isReferee ? 'referee' : 'player',
          matchNumber: eventRow.numero_partita ?? null,
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
  }, [teamId]);

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

  return (
    <div className="agenda-view">
      <div className="agenda-heading">
        <div>
          <h2>Agenda giornaliera</h2>
          <p>{team?.nome ?? 'Squadra selezionata'}</p>
        </div>
        {lunchTime && (
          <div className="agenda-lunch-summary">
            <span><AgendaIcon name="utensils" /> Pranzo</span>
            <strong>{lunchTime.slice(0, 5)}</strong>
          </div>
        )}
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
                <span>{formatDate(e.orario_inizio)}</span>
              </div>
              <div className="agenda-event-body">
                <div className="agenda-event-header">
                  <div>
                    <div className="agenda-event-topline">
                      <span className={`agenda-event-badge agenda-event-badge-${e.role}`}>
                        <AgendaIcon name={EVENT_META[e.role].icon} />
                        {EVENT_META[e.role].label}
                      </span>
                    </div>
                    <h3>{EVENT_META[e.role].title}</h3>
                  </div>
                  {e.status && <span className="agenda-status"><AgendaIcon name="pulse" />{e.status}</span>}
                </div>
                <p>{e.role === 'lunch' ? e.opponent : `${e.role === 'referee' ? 'Arbitro per' : 'Contro'}: ${e.opponent}`}</p>
                <div className="agenda-event-meta">
                  {e.matchNumber && <span><AgendaIcon name="hash" />Partita {e.matchNumber}</span>}
                  {e.campo && <span><AgendaIcon name="mapPin" />{e.campo}</span>}
                  <span><AgendaIcon name={EVENT_META[e.role].icon} />{EVENT_META[e.role].eyebrow}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
