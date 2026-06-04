import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

interface BracketProps {
  faseName: string;
}

interface MatchData {
  id: number;
  numero_partita: number;
  squadra_1_codice: string | null;
  squadra_2_codice: string | null;
  squadra_1_nome: string;
  squadra_2_nome: string;
  setWins1: number;
  setWins2: number;
  winner: string | null;
  orario_inizio: string | null;
  campo_nome: string;
}

interface BracketSlot extends MatchData {
  slotIndex: number;
}

type BracketViewMode = 'diagram' | 'cards';

const BRACKET_ROUNDS = [
  { title: 'Quarti', slotIndexes: [0, 1, 2, 3] },
  { title: 'Semifinali', slotIndexes: [4, 5] },
  { title: 'Finale', slotIndexes: [6] }
];

const GRAPH_NODES = [
  { slotIndex: 0, round: 'Quarto 1', x: 32, y: 24 },
  { slotIndex: 1, round: 'Quarto 2', x: 32, y: 198 },
  { slotIndex: 2, round: 'Quarto 3', x: 32, y: 372 },
  { slotIndex: 3, round: 'Quarto 4', x: 32, y: 546 },
  { slotIndex: 4, round: 'Semifinale 1', x: 360, y: 111 },
  { slotIndex: 5, round: 'Semifinale 2', x: 360, y: 459 },
  { slotIndex: 6, round: 'Finale', x: 688, y: 285 }
];

const GRAPH_EDGES = [
  { from: 0, to: 4, path: 'M 256 96 H 306 V 183 H 360' },
  { from: 1, to: 4, path: 'M 256 270 H 306 V 183 H 360' },
  { from: 2, to: 5, path: 'M 256 444 H 306 V 531 H 360' },
  { from: 3, to: 5, path: 'M 256 618 H 306 V 531 H 360' },
  { from: 4, to: 6, path: 'M 584 183 H 634 V 357 H 688' },
  { from: 5, to: 6, path: 'M 584 531 H 634 V 357 H 688' }
];

function createEmptySlot(slotIndex: number): BracketSlot {
  return {
    id: -100 - slotIndex,
    slotIndex,
    numero_partita: slotIndex + 1,
    squadra_1_codice: null,
    squadra_2_codice: null,
    squadra_1_nome: '',
    squadra_2_nome: '',
    setWins1: 0,
    setWins2: 0,
    winner: null,
    orario_inizio: null,
    campo_nome: ''
  };
}

function createSlots(matches: MatchData[]): BracketSlot[] {
  const slots = Array.from({ length: 7 }, (_, index) => createEmptySlot(index));
  matches.slice(0, 7).forEach((match, index) => {
    slots[index] = { ...match, slotIndex: index };
  });
  return slots;
}

function fallbackTeams(slotIndex: number) {
  if (slotIndex === 4) return ['Vincente Quarto 1', 'Vincente Quarto 2'];
  if (slotIndex === 5) return ['Vincente Quarto 3', 'Vincente Quarto 4'];
  if (slotIndex === 6) return ['Vincente Semifinale 1', 'Vincente Semifinale 2'];
  return ['Da assegnare', 'Da assegnare'];
}

function formatDateTime(value: string | null) {
  if (!value) return 'Orario da definire';
  return new Date(value).toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hasTeam(match: BracketSlot, teamCode: string | null) {
  return Boolean(
    teamCode &&
      (match.squadra_1_codice === teamCode || match.squadra_2_codice === teamCode)
  );
}

function winnerName(match: BracketSlot) {
  if (!match.winner) return '';
  return match.winner === match.squadra_1_codice ? match.squadra_1_nome : match.squadra_2_nome;
}

export default function Bracket({ faseName }: BracketProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<BracketViewMode>('diagram');

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      const { data: partite, error: partitaErr } = await supabase
        .from('v_partita_risultato')
        .select(
          'partita_id, numero_partita, squadra_1_codice, squadra_1_nome, squadra_2_codice, squadra_2_nome, squadra_vincitrice_codice, orario_inizio, campo_nome, set_vinti_squadra_1, set_vinti_squadra_2'
        )
        .eq('fase_torneo_codice', faseName)
        .order('numero_partita', { ascending: true });

      if (partitaErr || !partite) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const matchData: MatchData[] = partite.map((partita) => ({
        id: partita.partita_id,
        numero_partita: partita.numero_partita ?? 0,
        squadra_1_codice: partita.squadra_1_codice,
        squadra_2_codice: partita.squadra_2_codice,
        squadra_1_nome: partita.squadra_1_nome ?? '',
        squadra_2_nome: partita.squadra_2_nome ?? '',
        setWins1: partita.set_vinti_squadra_1 ?? 0,
        setWins2: partita.set_vinti_squadra_2 ?? 0,
        winner: partita.squadra_vincitrice_codice ?? null,
        orario_inizio: partita.orario_inizio ?? null,
        campo_nome: partita.campo_nome ?? ''
      }));

      setMatches(matchData.filter((m) => m.numero_partita > 0));
      setLoading(false);
    }
    fetchMatches();

    const channel = supabase
      .channel(`bracket-live-${faseName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fase_torneo' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squadra' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campo' }, () => fetchMatches())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName]);

  const slots = createSlots(matches);

  const renderMatchContent = (match: BracketSlot, compact = false) => {
    const [fallbackA, fallbackB] = fallbackTeams(match.slotIndex);
    const teamA = match.squadra_1_nome || fallbackA;
    const teamB = match.squadra_2_nome || fallbackB;
    const showScore = Boolean(match.squadra_1_nome && match.squadra_2_nome);

    return (
      <>
        <div className="bracket-match-heading">
          <span>{GRAPH_NODES.find((node) => node.slotIndex === match.slotIndex)?.round}</span>
          <strong>Partita {match.numero_partita}</strong>
        </div>
        {compact ? (
          <div className="bracket-graph-meta">
            <span>{formatDateTime(match.orario_inizio)}</span>
            <span>{match.campo_nome || 'Campo da definire'}</span>
          </div>
        ) : (
          <div className="bracket-meta">{formatDateTime(match.orario_inizio)}</div>
        )}
        {!compact && (
          <div className="bracket-meta">
            {match.campo_nome ? `Campo: ${match.campo_nome}` : 'Campo da definire'}
          </div>
        )}
        <div className={`bracket-team-line ${match.winner === match.squadra_1_codice ? 'bracket-team-winner' : ''}`}>
          <span>{teamA}</span>
          <strong>{showScore ? match.setWins1 : '-'}</strong>
        </div>
        <div className={`bracket-team-line ${match.winner === match.squadra_2_codice ? 'bracket-team-winner' : ''}`}>
          <span>{teamB}</span>
          <strong>{showScore ? match.setWins2 : '-'}</strong>
        </div>
        {match.winner && !compact && (
          <div className="bracket-winner">Vincente: {winnerName(match)}</div>
        )}
      </>
    );
  };

  return (
    <div className="bracket-view">
      <div className="bracket-heading">
        <h2>Fase {faseName}</h2>
        <div className="bracket-view-switch" role="group" aria-label="Vista tabellone">
          <button
            type="button"
            className={viewMode === 'diagram' ? 'bracket-view-switch-active' : ''}
            aria-pressed={viewMode === 'diagram'}
            onClick={() => setViewMode('diagram')}
          >
            Diagramma
          </button>
          <button
            type="button"
            className={viewMode === 'cards' ? 'bracket-view-switch-active' : ''}
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
          >
            Card
          </button>
        </div>
      </div>
      {loading ? (
        <div className="agenda-loading" aria-live="polite" aria-busy="true">
          <div className="agenda-spinner" />
          <div>
            <strong>Caricamento tabellone</strong>
            <span>Sto sincronizzando partite e risultati live...</span>
          </div>
        </div>
      ) : (
        <>
          {matches.length === 0 && (
            <p className="bracket-empty">
              Nessuna squadra ancora assegnata: il tabellone vuoto è pronto.
            </p>
          )}

          {viewMode === 'diagram' ? (
            <div className="bracket-graph-scroll">
              <div className="bracket-graph">
                <svg className="bracket-graph-lines" viewBox="0 0 940 714" preserveAspectRatio="none">
                  {GRAPH_EDGES.map((edge) => {
                    const from = slots[edge.from];
                    const to = slots[edge.to];
                    const isWinnerPath = hasTeam(to, from.winner);
                    return (
                      <path
                        key={`${edge.from}-${edge.to}`}
                        className={`bracket-graph-edge ${isWinnerPath ? 'bracket-graph-edge-active' : ''}`}
                        d={edge.path}
                      />
                    );
                  })}
                </svg>

                {GRAPH_NODES.map((node) => {
                  const match = slots[node.slotIndex];
                  return (
                    <div
                      key={node.slotIndex}
                      className={`bracket-graph-node ${match.winner ? 'bracket-graph-node-complete' : ''}`}
                      style={{ left: node.x, top: node.y }}
                    >
                      {renderMatchContent(match, true)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bracket-card-view">
              {BRACKET_ROUNDS.map((round) => (
                <div key={round.title} className="bracket-round">
                  <h3>{round.title}</h3>
                  {round.slotIndexes.map((slotIndex) => (
                    <div key={slotIndex} className="bracket-match-card">
                      {renderMatchContent(slots[slotIndex])}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
