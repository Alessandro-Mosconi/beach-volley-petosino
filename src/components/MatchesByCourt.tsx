import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';

interface Court {
  codice: string;
  nome: string;
  ordine: number;
}

interface CourtMatch {
  partita_id: number;
  fase_torneo_codice: string;
  girone_codice: string | null;
  campo_codice: string;
  campo_nome: string;
  orario_inizio: string;
  squadra_1_nome: string;
  squadra_2_nome: string;
  squadra_arbitro_nome: string | null;
  arbitro_organizzazione: boolean;
  risultato_set: string;
  stato: string;
}

interface LunchEvent {
  squadra_codice: string;
  squadra_nome: string;
  orario_inizio: string;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRound(match: CourtMatch) {
  if (match.fase_torneo_codice === 'GIRONI' && match.girone_codice) {
    return match.girone_codice.replace('GIRONE_', 'Girone ');
  }
  return match.fase_torneo_codice;
}

function MatchCell({ match }: { match: CourtMatch | null }) {
  if (!match) {
    return <div className="court-match-empty">Nessuna partita</div>;
  }

  const referee = match.arbitro_organizzazione
    ? 'Organizzazione'
    : match.squadra_arbitro_nome ?? 'Da definire';

  return (
    <article className={`court-match-card court-match-card-${match.stato}`}>
      <div className="court-match-topline">
        <span>{match.campo_nome}</span>
        <strong>{formatRound(match)}</strong>
      </div>
      <div className="court-match-teams">
        <span>{match.squadra_1_nome}</span>
        <small>vs</small>
        <span>{match.squadra_2_nome}</span>
      </div>
      <div className="court-match-details">
        <span>Arbitro: {referee}</span>
        <span>Stato: {match.stato}</span>
        {match.risultato_set !== '0-0' && <span>Set: {match.risultato_set}</span>}
      </div>
    </article>
  );
}

function LunchCell({ lunches }: { lunches: LunchEvent[] }) {
  if (lunches.length === 0) {
    return <div className="court-match-empty court-lunch-empty">Nessun pranzo</div>;
  }

  return (
    <article className="court-lunch-card">
      <div className="court-match-topline">
        <span>Pausa pranzo</span>
        <strong>{lunches.length}</strong>
      </div>
      <div className="court-lunch-list">
        {lunches.map((lunch) => (
          <span key={lunch.squadra_codice}>{lunch.squadra_nome}</span>
        ))}
      </div>
    </article>
  );
}

interface MatchesByCourtProps {
  tournamentId: number;
}

export default function MatchesByCourt({ tournamentId }: MatchesByCourtProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<CourtMatch[]>([]);
  const [lunches, setLunches] = useState<LunchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [courtsRes, matchesRes, lunchesRes] = await Promise.all([
        supabase
          .from('campo')
          .select('codice, nome, ordine')
          .eq('torneo_id', tournamentId)
          .order('ordine', { ascending: true }),
        supabase
          .from('v_partita_risultato')
          .select(
            'partita_id, fase_torneo_codice, girone_codice, campo_codice, campo_nome, orario_inizio, squadra_1_nome, squadra_2_nome, squadra_arbitro_nome, arbitro_organizzazione, risultato_set, stato'
          )
          .eq('torneo_id', tournamentId)
          .order('orario_inizio', { ascending: true })
          .order('campo_codice', { ascending: true }),
        supabase
          .from('v_agenda_squadra')
          .select('squadra_codice, squadra_nome, orario_inizio, torneo_id')
          .eq('torneo_id', tournamentId)
          .eq('tipo_evento', 'PRANZO')
          .order('orario_inizio', { ascending: true })
      ]);

      if (courtsRes.error || matchesRes.error || lunchesRes.error) {
        setCourts([]);
        setMatches([]);
        setLunches([]);
        setLoadError(
          courtsRes.error?.message ??
            matchesRes.error?.message ??
            lunchesRes.error?.message ??
            'Errore caricamento partite'
        );
        setLoading(false);
        return;
      }

      setCourts((courtsRes.data ?? []) as Court[]);
      setMatches((matchesRes.data ?? []) as CourtMatch[]);
      setLunches((lunchesRes.data ?? []) as LunchEvent[]);
      setLoadError(null);
      setLoading(false);
    }

    fetchData();

    const channel = supabase
      .channel('matches-by-court-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campo' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squadra' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneo' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const scheduleRows = useMemo(() => {
    const times = Array.from(
      new Set([
        ...matches.map((match) => match.orario_inizio),
        ...lunches.map((lunch) => lunch.orario_inizio)
      ])
    ).sort();
    return times.map((time) => ({
      time,
      matchesByCourt: new Map(
        matches
          .filter((match) => match.orario_inizio === time)
          .map((match) => [match.campo_codice, match])
      ),
      lunches: lunches.filter((lunch) => lunch.orario_inizio === time)
    }));
  }, [matches, lunches]);

  if (loading) {
    return (
      <div className="agenda-loading" aria-live="polite" aria-busy="true">
        <div className="agenda-spinner" />
        <div>
          <strong>Caricamento partite</strong>
          <span>Sto preparando il planning dei campi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="courts-view">
      <div className="courts-heading">
        <div>
          <h2>Partite per campo</h2>
          <p>Partite affiancate per orario, con squadre e arbitraggio.</p>
        </div>
      </div>

      {loadError ? (
        <p className="agenda-empty">Errore Supabase: {loadError}</p>
      ) : scheduleRows.length === 0 ? (
        <p className="agenda-empty">Nessuna partita programmata.</p>
      ) : (
        <>
          <div className="courts-grid" style={{ '--court-count': courts.length + 1 } as React.CSSProperties}>
            <div className="courts-grid-header courts-grid-time-header">Ora</div>
            {courts.map((court) => (
              <div key={court.codice} className="courts-grid-header">
                {court.nome}
              </div>
            ))}
            <div className="courts-grid-header courts-lunch-header">Pranzo</div>
            {scheduleRows.map((row) => (
              <div key={row.time} className="courts-grid-row">
                <div className="courts-time-cell">{formatTime(row.time)}</div>
                {courts.map((court) => (
                  <div key={`${row.time}-${court.codice}`} className="courts-match-cell">
                    <MatchCell match={row.matchesByCourt.get(court.codice) ?? null} />
                  </div>
                ))}
                <div className="courts-match-cell">
                  <LunchCell lunches={row.lunches} />
                </div>
              </div>
            ))}
          </div>

          <div className="courts-mobile-list">
            {scheduleRows.map((row) => (
              <section key={row.time} className="courts-mobile-slot">
                <h3>{formatTime(row.time)}</h3>
                <div className="courts-mobile-cards">
                  {courts.map((court) => (
                    <div key={`${row.time}-${court.codice}`} className="courts-mobile-court">
                      <strong>{court.nome}</strong>
                      <MatchCell match={row.matchesByCourt.get(court.codice) ?? null} />
                    </div>
                  ))}
                  <div className="courts-mobile-court">
                    <strong>Pranzo</strong>
                    <LunchCell lunches={row.lunches} />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
