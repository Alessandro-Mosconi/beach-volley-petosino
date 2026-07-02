import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';

interface Court {
  codice: string;
  nome: string;
  ordine: number;
}

interface TeamOption {
  codice: string;
  nome: string;
}

interface PhaseOption {
  codice: string;
  nome: string;
  tipo: string;
}

interface GroupOption {
  codice: string;
  nome: string;
}

interface CourtMatch {
  partita_id: number;
  fase_torneo_codice: string;
  girone_codice: string | null;
  slot_tabellone: string | null;
  campo_codice: string;
  campo_nome: string;
  orario_inizio: string;
  squadra_1_codice: string;
  squadra_2_codice: string;
  squadra_1_nome: string;
  squadra_2_nome: string;
  squadra_arbitro_codice: string | null;
  squadra_arbitro_nome: string | null;
  arbitro_organizzazione: boolean;
  risultato_set: string;
  stato: string;
  note: string | null;
}

interface MatchSet {
  id: number;
  partita_id: number;
  numero_set: number;
  punteggio_squadra_1: number;
  punteggio_squadra_2: number;
}

type SetDraft = {
  numero_set: number;
  punteggio_squadra_1: string;
  punteggio_squadra_2: string;
};

const BRACKET_SLOT_OPTIONS = [
  { value: 'QUARTI_1', label: 'Quarto 1' },
  { value: 'QUARTI_2', label: 'Quarto 2' },
  { value: 'QUARTI_3', label: 'Quarto 3' },
  { value: 'QUARTI_4', label: 'Quarto 4' },
  { value: 'SEMIFINALE_1', label: 'Semifinale 1' },
  { value: 'SEMIFINALE_2', label: 'Semifinale 2' },
  { value: 'FINALE', label: 'Finale' },
  { value: 'FINALINA', label: 'Finalina 3/4 posto' }
];

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

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

function dayKey(value: string) {
  return new Date(value).toLocaleDateString('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatRound(match: CourtMatch) {
  if (match.fase_torneo_codice === 'GIRONI' && match.girone_codice) {
    return match.girone_codice.replace(/^.*GIRONE_/, 'Girone ');
  }
  const bracketSlot = BRACKET_SLOT_OPTIONS.find((slot) => slot.value === match.slot_tabellone);
  if (bracketSlot) {
    return `${match.fase_torneo_codice} - ${bracketSlot.label}`;
  }
  return match.fase_torneo_codice;
}

function formatSetList(sets: MatchSet[]) {
  if (sets.length === 0) return null;
  return sets
    .slice()
    .sort((a, b) => a.numero_set - b.numero_set)
    .map((set) => `${set.punteggio_squadra_1}-${set.punteggio_squadra_2}`)
    .join(' / ');
}

function shouldShowMatchStatus(status: string) {
  return status.trim().toLowerCase() !== 'programmata';
}

function formatMatchStatus(status: string) {
  switch (status.trim().toLowerCase()) {
    case 'in_corso':
      return 'In corso';
    case 'terminata':
      return 'Terminata';
    default:
      return status;
  }
}

function isBracketPhase(phaseCode: string, phases: PhaseOption[]) {
  return phases.find((phase) => phase.codice === phaseCode)?.tipo === 'ELIMINAZIONE_DIRETTA';
}

function getSetWins(sets: MatchSet[]) {
  return sets.reduce(
    (wins, set) => {
      if (set.punteggio_squadra_1 > set.punteggio_squadra_2) return { ...wins, team1: wins.team1 + 1 };
      if (set.punteggio_squadra_2 > set.punteggio_squadra_1) return { ...wins, team2: wins.team2 + 1 };
      return wins;
    },
    { team1: 0, team2: 0 }
  );
}

function getWinningSide(sets: MatchSet[]) {
  if (sets.length === 0) return null;

  const setWins = getSetWins(sets);

  if (setWins.team1 === setWins.team2) return null;
  return setWins.team1 > setWins.team2 ? 'team1' : 'team2';
}

function isDrawMatch(sets: MatchSet[]) {
  if (sets.length === 0) return false;
  const setWins = getSetWins(sets);
  return setWins.team1 === setWins.team2;
}

function getMatchOutcome(match: CourtMatch, sets: MatchSet[]) {
  if (sets.length === 0) return null;

  const setWins = getSetWins(sets);
  if (setWins.team1 === setWins.team2) {
    return {
      label: 'Pareggio',
      detail: `${setWins.team1}-${setWins.team2} nei set`,
      className: 'court-match-card-draw'
    };
  }

  const winnerName = setWins.team1 > setWins.team2 ? match.squadra_1_nome : match.squadra_2_nome;
  return {
    label: `Vince ${winnerName}`,
    detail: `${setWins.team1}-${setWins.team2} nei set`,
    className: 'court-match-card-won'
  };
}

function MatchCell({
  match,
  sets,
  canEdit,
  onEditResult,
  onEditMatch
}: {
  match: CourtMatch | null;
  sets: MatchSet[];
  canEdit: boolean;
  onEditResult: (match: CourtMatch) => void;
  onEditMatch: (match: CourtMatch) => void;
}) {
  if (!match) {
    return <div className="court-match-empty">Nessuna partita</div>;
  }

  const referee = match.arbitro_organizzazione
    ? 'Organizzazione'
    : match.squadra_arbitro_nome ?? 'Da definire';
  const setList = formatSetList(sets);
  const winningSide = getWinningSide(sets);
  const isDraw = isDrawMatch(sets);
  const outcome = getMatchOutcome(match, sets);

  return (
    <article className={`court-match-card court-match-card-${match.stato} ${outcome?.className ?? ''}`}>
      <div className="court-match-topline">
        <strong>{formatRound(match)}</strong>
        {outcome && (
          <span className="court-match-outcome">
            {outcome.label}
          </span>
        )}
      </div>
      <div className="court-match-teams">
        <span className={winningSide === 'team1' ? 'court-match-team-winner' : isDraw ? 'court-match-team-draw' : undefined}>{match.squadra_1_nome}</span>
        <small>vs</small>
        <span className={winningSide === 'team2' ? 'court-match-team-winner' : isDraw ? 'court-match-team-draw' : undefined}>{match.squadra_2_nome}</span>
      </div>
      <div className="court-match-details">
        <span>Arbitro: {referee}</span>
        {shouldShowMatchStatus(match.stato) && <span>{formatMatchStatus(match.stato)}</span>}
        {outcome && <span>{outcome.detail}</span>}
        {setList && <span>Set: {setList}</span>}
      </div>
      {canEdit && (
        <div className="court-card-actions">
          <button className="court-edit-button" type="button" onClick={() => onEditResult(match)}>
            Risultato
          </button>
          <button className="court-edit-button court-edit-secondary" type="button" onClick={() => onEditMatch(match)}>
            Partita
          </button>
        </div>
      )}
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
  canEdit: boolean;
}

function createSetDrafts(sets: MatchSet[]): SetDraft[] {
  const sortedSets = sets.slice().sort((a, b) => a.numero_set - b.numero_set);
  if (sortedSets.length === 0) {
    return [{ numero_set: 1, punteggio_squadra_1: '0', punteggio_squadra_2: '0' }];
  }

  return sortedSets.map((set, index) => ({
    numero_set: index + 1,
    punteggio_squadra_1: String(set.punteggio_squadra_1),
    punteggio_squadra_2: String(set.punteggio_squadra_2)
  }));
}

function toDateTimeInputValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function MatchEditor({
  match,
  tournamentId,
  courts,
  teams,
  phases,
  groups,
  saving,
  error,
  onCancel,
  onSave,
  onDelete
}: {
  match: CourtMatch | null;
  tournamentId: number;
  courts: Court[];
  teams: TeamOption[];
  phases: PhaseOption[];
  groups: GroupOption[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onDelete?: (match: CourtMatch) => void;
  onSave: (values: {
    torneo_id: number;
    fase_torneo_codice: string;
    girone_codice: string | null;
    slot_tabellone: string | null;
    campo_codice: string;
    orario_inizio: string;
    squadra_1_codice: string;
    squadra_2_codice: string;
    squadra_arbitro_codice: string | null;
    stato: string;
    note: string | null;
  }) => void;
}) {
  const [fase, setFase] = useState(match?.fase_torneo_codice ?? phases[0]?.codice ?? 'GIRONI');
  const [girone, setGirone] = useState(match?.girone_codice ?? '');
  const [slotTabellone, setSlotTabellone] = useState(match?.slot_tabellone ?? '');
  const [campo, setCampo] = useState(match?.campo_codice ?? courts[0]?.codice ?? '');
  const [orario, setOrario] = useState(match ? toDateTimeInputValue(match.orario_inizio) : '');
  const [squadra1, setSquadra1] = useState(match?.squadra_1_codice ?? teams[0]?.codice ?? '');
  const [squadra2, setSquadra2] = useState(match?.squadra_2_codice ?? teams[1]?.codice ?? teams[0]?.codice ?? '');
  const [arbitro, setArbitro] = useState(match?.squadra_arbitro_codice ?? '');
  const [stato, setStato] = useState(match?.stato ?? 'programmata');
  const [note, setNote] = useState(match?.note ?? '');

  useEffect(() => {
    setFase(match?.fase_torneo_codice ?? phases[0]?.codice ?? 'GIRONI');
    setGirone(match?.girone_codice ?? '');
    setSlotTabellone(match?.slot_tabellone ?? '');
    setCampo(match?.campo_codice ?? courts[0]?.codice ?? '');
    setOrario(match ? toDateTimeInputValue(match.orario_inizio) : '');
    setSquadra1(match?.squadra_1_codice ?? teams[0]?.codice ?? '');
    setSquadra2(match?.squadra_2_codice ?? teams[1]?.codice ?? teams[0]?.codice ?? '');
    setArbitro(match?.squadra_arbitro_codice ?? '');
    setStato(match?.stato ?? 'programmata');
    setNote(match?.note ?? '');
  }, [match, courts, teams, phases]);

  return (
    <div className="result-editor-backdrop" role="presentation">
      <form
        className="result-editor match-editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            torneo_id: tournamentId,
            fase_torneo_codice: fase,
            girone_codice: fase === 'GIRONI' ? girone || null : null,
            slot_tabellone: isBracketPhase(fase, phases) ? slotTabellone || null : null,
            campo_codice: campo,
            orario_inizio: new Date(orario).toISOString(),
            squadra_1_codice: squadra1,
            squadra_2_codice: squadra2,
            squadra_arbitro_codice: arbitro || null,
            stato,
            note: note.trim() || null
          });
        }}
      >
        <div className="result-editor-heading">
          <div>
            <span>{match ? 'Modifica partita' : 'Nuova partita'}</span>
            <h3>{match ? `${match.squadra_1_nome} vs ${match.squadra_2_nome}` : 'Dettagli partita'}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Chiudi">
            X
          </button>
        </div>

        <div className="match-editor-grid">
          <label>
            Fase
            <select value={fase} onChange={(event) => setFase(event.target.value)} required>
              {phases.map((phase) => (
                <option key={phase.codice} value={phase.codice}>{phase.nome}</option>
              ))}
            </select>
          </label>
          {!isBracketPhase(fase, phases) ? (
            <label>
              Girone
              <select value={girone} onChange={(event) => setGirone(event.target.value)}>
                <option value="">Nessuno</option>
                {groups.map((group) => (
                  <option key={group.codice} value={group.codice}>{group.nome}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Slot tabellone
              <select value={slotTabellone} onChange={(event) => setSlotTabellone(event.target.value)} required>
                <option value="">Scegli slot</option>
                {BRACKET_SLOT_OPTIONS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Campo
            <select value={campo} onChange={(event) => setCampo(event.target.value)} required>
              {courts.map((court) => (
                <option key={court.codice} value={court.codice}>{court.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Orario
            <input type="datetime-local" value={orario} onChange={(event) => setOrario(event.target.value)} required />
          </label>
          <label>
            Squadra 1
            <select value={squadra1} onChange={(event) => setSquadra1(event.target.value)} required>
              {teams.map((team) => (
                <option key={team.codice} value={team.codice}>{team.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Squadra 2
            <select value={squadra2} onChange={(event) => setSquadra2(event.target.value)} required>
              {teams.map((team) => (
                <option key={team.codice} value={team.codice}>{team.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Arbitro
            <select value={arbitro} onChange={(event) => setArbitro(event.target.value)}>
              <option value="">Organizzazione</option>
              {teams.map((team) => (
                <option key={team.codice} value={team.codice}>{team.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Stato
            <select value={stato} onChange={(event) => setStato(event.target.value)}>
              <option value="programmata">Programmata</option>
              <option value="in_corso">In corso</option>
              <option value="terminata">Terminata</option>
            </select>
          </label>
          <label className="match-editor-wide">
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>

        {error && <p className="result-editor-error">{error}</p>}

        <div className="result-editor-actions">
          {match && onDelete && (
            <button
              className="dialog-delete-button"
              type="button"
              onClick={() => onDelete(match)}
              disabled={saving}
            >
              Elimina partita
            </button>
          )}
          <button type="button" onClick={onCancel}>
            Annulla
          </button>
          <button type="submit" disabled={saving}>
            Salva partita
          </button>
        </div>
      </form>
    </div>
  );
}

function ResultEditor({
  match,
  sets,
  saving,
  error,
  onCancel,
  onSave
}: {
  match: CourtMatch;
  sets: MatchSet[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (drafts: SetDraft[], stato: string) => void;
}) {
  const [drafts, setDrafts] = useState<SetDraft[]>(() => createSetDrafts(sets));
  const [stato, setStato] = useState(match.stato);

  useEffect(() => {
    setDrafts(createSetDrafts(sets));
    setStato(match.stato);
  }, [match, sets]);

  const updateDraft = (numero_set: number, field: keyof Omit<SetDraft, 'numero_set'>, value: string) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.numero_set === numero_set ? { ...draft, [field]: value.replace(/[^\d]/g, '') } : draft
      )
    );
  };

  const renumberDrafts = (nextDrafts: SetDraft[]) =>
    nextDrafts.map((draft, index) => ({ ...draft, numero_set: index + 1 }));

  const addSet = () => {
    setDrafts((currentDrafts) => [
      ...currentDrafts,
      { numero_set: currentDrafts.length + 1, punteggio_squadra_1: '0', punteggio_squadra_2: '0' }
    ]);
  };

  const removeSet = (numero_set: number) => {
    setDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts.filter((draft) => draft.numero_set !== numero_set);
      return nextDrafts.length === 0
        ? [{ numero_set: 1, punteggio_squadra_1: '', punteggio_squadra_2: '' }]
        : renumberDrafts(nextDrafts);
    });
  };

  const stepDraft = (numero_set: number, field: keyof Omit<SetDraft, 'numero_set'>, delta: number) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.numero_set !== numero_set) return draft;
        const nextValue = Math.max(0, Number(draft[field] || 0) + delta);
        return { ...draft, [field]: String(nextValue) };
      })
    );
  };

  const setWinnerLabel = (draft: SetDraft) => {
    if (draft.punteggio_squadra_1 === '' || draft.punteggio_squadra_2 === '') {
      return 'In attesa dei punteggi';
    }

    const score1 = Number(draft.punteggio_squadra_1);
    const score2 = Number(draft.punteggio_squadra_2);
    if (score1 === score2) {
      return 'Parita non valida';
    }

    return `Vince: ${score1 > score2 ? match.squadra_1_nome : match.squadra_2_nome}`;
  };

  return (
    <div className="result-editor-backdrop" role="presentation">
      <form
        className="result-editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(drafts, stato);
        }}
      >
        <div className="result-editor-heading">
          <div>
            <span>{formatRound(match)}</span>
            <h3>{match.squadra_1_nome} vs {match.squadra_2_nome}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Chiudi">
            X
          </button>
        </div>

        <label className="result-status-field">
          Stato
          <select value={stato} onChange={(event) => setStato(event.target.value)}>
            <option value="programmata">Programmata</option>
            <option value="in_corso">In corso</option>
            <option value="terminata">Terminata</option>
          </select>
        </label>

        <div className="result-team-headings">
          <strong>{match.squadra_1_nome}</strong>
          <strong>{match.squadra_2_nome}</strong>
        </div>

        <div className="result-set-list">
          {drafts.map((draft) => (
            <div className="result-set-card" key={draft.numero_set}>
              <div className="result-set-name">
                <strong>Set {draft.numero_set}</strong>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => removeSet(draft.numero_set)}>
                    Rimuovi
                  </button>
                )}
              </div>
              <div className="score-pair">
                <div className="score-stepper">
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_1', -1)}>-</button>
                  <input
                    inputMode="numeric"
                    value={draft.punteggio_squadra_1}
                    onChange={(event) => updateDraft(draft.numero_set, 'punteggio_squadra_1', event.target.value)}
                    aria-label={`${match.squadra_1_nome} set ${draft.numero_set}`}
                    placeholder="0"
                  />
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_1', 1)}>+</button>
                </div>
                <div className="score-stepper">
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_2', -1)}>-</button>
                  <input
                    inputMode="numeric"
                    value={draft.punteggio_squadra_2}
                    onChange={(event) => updateDraft(draft.numero_set, 'punteggio_squadra_2', event.target.value)}
                    aria-label={`${match.squadra_2_nome} set ${draft.numero_set}`}
                    placeholder="0"
                  />
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_2', 1)}>+</button>
                </div>
              </div>
              <span
                className={`set-winner-preview ${
                  draft.punteggio_squadra_1 !== '' &&
                  draft.punteggio_squadra_2 !== '' &&
                  draft.punteggio_squadra_1 === draft.punteggio_squadra_2
                    ? 'set-winner-preview-error'
                    : ''
                }`}
              >
                {setWinnerLabel(draft)}
              </span>
            </div>
          ))}
        </div>

        <button className="add-set-button" type="button" onClick={addSet}>
          Aggiungi set
        </button>

        {error && <p className="result-editor-error">{error}</p>}

        <div className="result-editor-actions">
          <button type="button" onClick={onCancel}>
            Annulla
          </button>
          <button type="submit" disabled={saving}>
            Salva risultato
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MatchesByCourt({ tournamentId, canEdit }: MatchesByCourtProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [matches, setMatches] = useState<CourtMatch[]>([]);
  const [setsByMatch, setSetsByMatch] = useState<Record<number, MatchSet[]>>({});
  const [lunches, setLunches] = useState<LunchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<CourtMatch | null>(null);
  const [editingMatchDetails, setEditingMatchDetails] = useState<CourtMatch | null | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [courtsRes, teamsRes, phasesRes, groupsRes, matchesRes, lunchesRes] = await Promise.all([
        supabase
          .from('campo')
          .select('codice, nome, ordine')
          .eq('torneo_id', tournamentId)
          .order('ordine', { ascending: true }),
        supabase
          .from('squadra')
          .select('codice, nome')
          .eq('torneo_id', tournamentId)
          .order('nome', { ascending: true }),
        supabase
          .from('v_torneo_fase')
          .select('codice, nome, tipo, ordine')
          .eq('torneo_id', tournamentId)
          .order('ordine', { ascending: true }),
        supabase
          .from('girone')
          .select('codice, nome')
          .eq('torneo_id', tournamentId)
          .order('codice', { ascending: true }),
        supabase
          .from('v_partita_risultato')
          .select(
            'partita_id, fase_torneo_codice, girone_codice, slot_tabellone, campo_codice, campo_nome, orario_inizio, squadra_1_codice, squadra_2_codice, squadra_1_nome, squadra_2_nome, squadra_arbitro_codice, squadra_arbitro_nome, arbitro_organizzazione, risultato_set, stato, note'
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

      if (courtsRes.error || teamsRes.error || phasesRes.error || groupsRes.error || matchesRes.error || lunchesRes.error) {
        setCourts([]);
        setTeams([]);
        setPhases([]);
        setGroups([]);
        setMatches([]);
        setLunches([]);
        setLoadError(
          courtsRes.error?.message ??
            teamsRes.error?.message ??
            phasesRes.error?.message ??
            groupsRes.error?.message ??
            matchesRes.error?.message ??
            lunchesRes.error?.message ??
            'Errore caricamento partite'
        );
        setLoading(false);
        return;
      }

      const matchIds = (matchesRes.data ?? []).map((match) => match.partita_id);
      const setsRes = matchIds.length > 0
        ? await supabase
            .from('partita_set')
            .select('id, partita_id, numero_set, punteggio_squadra_1, punteggio_squadra_2')
            .in('partita_id', matchIds)
            .order('numero_set', { ascending: true })
        : { data: [], error: null };

      if (setsRes.error) {
        setCourts([]);
        setMatches([]);
        setSetsByMatch({});
        setLunches([]);
        setLoadError(setsRes.error.message);
        setLoading(false);
        return;
      }

      const nextSetsByMatch = ((setsRes.data ?? []) as MatchSet[]).reduce<Record<number, MatchSet[]>>((acc, set) => {
        acc[set.partita_id] = [...(acc[set.partita_id] ?? []), set];
        return acc;
      }, {});

      setCourts((courtsRes.data ?? []) as Court[]);
      setTeams((teamsRes.data ?? []) as TeamOption[]);
      setPhases((phasesRes.data ?? []) as PhaseOption[]);
      setGroups((groupsRes.data ?? []) as GroupOption[]);
      setMatches((matchesRes.data ?? []) as CourtMatch[]);
      setSetsByMatch(nextSetsByMatch);
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

  const saveResult = async (drafts: SetDraft[], stato: string) => {
    if (!editingMatch) return;

    setSaving(true);
    setSaveError(null);

    const currentSets = setsByMatch[editingMatch.partita_id] ?? [];
    const completeDrafts = drafts.filter((draft) => draft.punteggio_squadra_1 !== '' || draft.punteggio_squadra_2 !== '');
    const incompleteDraft = completeDrafts.find((draft) => draft.punteggio_squadra_1 === '' || draft.punteggio_squadra_2 === '');
    const tiedDraft = completeDrafts.find((draft) => Number(draft.punteggio_squadra_1) === Number(draft.punteggio_squadra_2));

    if (incompleteDraft) {
      setSaveError(`Completa entrambi i punteggi del Set ${incompleteDraft.numero_set}.`);
      setSaving(false);
      return;
    }

    if (tiedDraft) {
      setSaveError(`Il Set ${tiedDraft.numero_set} non puo' finire in parita'.`);
      setSaving(false);
      return;
    }

    const rowsToUpsert = completeDrafts.map((draft) => ({
      partita_id: editingMatch.partita_id,
      numero_set: draft.numero_set,
      punteggio_squadra_1: Number(draft.punteggio_squadra_1),
      punteggio_squadra_2: Number(draft.punteggio_squadra_2),
      squadra_vincitrice_codice:
        Number(draft.punteggio_squadra_1) > Number(draft.punteggio_squadra_2)
          ? editingMatch.squadra_1_codice
          : editingMatch.squadra_2_codice
    }));
    const numbersToKeep = new Set(rowsToUpsert.map((row) => row.numero_set));
    const idsToDelete = currentSets
      .filter((set) => !numbersToKeep.has(set.numero_set))
      .map((set) => set.id);

    const { error: upsertError } = rowsToUpsert.length > 0
      ? await supabase.from('partita_set').upsert(rowsToUpsert, { onConflict: 'partita_id,numero_set' })
      : { error: null };

    if (upsertError) {
      setSaveError(upsertError.message);
      setSaving(false);
      return;
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('partita_set').delete().in('id', idsToDelete);
      if (deleteError) {
        setSaveError(deleteError.message);
        setSaving(false);
        return;
      }
    }

    const { error: matchError } = await supabase
      .from('partita')
      .update({ stato })
      .eq('id', editingMatch.partita_id);

    if (matchError) {
      setSaveError(matchError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingMatch(null);
  };

  const saveMatchDetails = async (values: {
    torneo_id: number;
    fase_torneo_codice: string;
    girone_codice: string | null;
    slot_tabellone: string | null;
    campo_codice: string;
    orario_inizio: string;
    squadra_1_codice: string;
    squadra_2_codice: string;
    squadra_arbitro_codice: string | null;
    stato: string;
    note: string | null;
  }) => {
    setSaving(true);
    setSaveError(null);

    if (values.squadra_1_codice === values.squadra_2_codice) {
      setSaveError('Scegli due squadre diverse.');
      setSaving(false);
      return;
    }

    if (
      values.squadra_arbitro_codice &&
      [values.squadra_1_codice, values.squadra_2_codice].includes(values.squadra_arbitro_codice)
    ) {
      setSaveError('La squadra arbitro non puo\' essere una delle due squadre in campo.');
      setSaving(false);
      return;
    }

    if (isBracketPhase(values.fase_torneo_codice, phases) && !values.slot_tabellone) {
      setSaveError('Scegli lo slot tabellone per la fase a eliminazione.');
      setSaving(false);
      return;
    }

    const request = editingMatchDetails
      ? supabase.from('partita').update(values).eq('id', editingMatchDetails.partita_id)
      : supabase.from('partita').insert(values);
    const { error } = await request;

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingMatchDetails(undefined);
  };

  const deleteMatch = async (match: CourtMatch) => {
    const confirmed = window.confirm(`Eliminare la partita ${match.squadra_1_nome} vs ${match.squadra_2_nome}?`);
    if (!confirmed) return;

    setSaving(true);
    setSaveError(null);

    const { error } = await supabase
      .from('partita')
      .delete()
      .eq('id', match.partita_id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingMatchDetails(undefined);
  };

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

  const scheduleDays = useMemo(() => {
    const days = new Map<string, { label: string; rows: typeof scheduleRows }>();
    scheduleRows.forEach((row) => {
      const key = dayKey(row.time);
      const currentDay = days.get(key) ?? { label: formatDay(row.time), rows: [] };
      currentDay.rows.push(row);
      days.set(key, currentDay);
    });
    return Array.from(days.entries()).map(([key, day]) => ({ key, ...day }));
  }, [scheduleRows]);

  const hasMultipleScheduleDays = scheduleDays.length > 1;
  const hasLunches = lunches.length > 0;

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

  const editorPortal = (
    <>
      {editingMatch && (
        <ResultEditor
          match={editingMatch}
          sets={setsByMatch[editingMatch.partita_id] ?? []}
          saving={saving}
          error={saveError}
          onCancel={() => {
            setEditingMatch(null);
            setSaveError(null);
          }}
          onSave={saveResult}
        />
      )}
      {editingMatchDetails !== undefined && (
        <MatchEditor
          match={editingMatchDetails}
          tournamentId={tournamentId}
          courts={courts}
          teams={teams}
          phases={phases}
          groups={groups}
          saving={saving}
          error={saveError}
          onCancel={() => {
            setEditingMatchDetails(undefined);
            setSaveError(null);
          }}
          onSave={saveMatchDetails}
          onDelete={deleteMatch}
        />
      )}
    </>
  );

  return (
    <div className="courts-view">
      <div className="courts-heading">
        <div>
          <h2>Partite per campo</h2>
        </div>
        {canEdit && (
          <button
            className="add-match-button"
            type="button"
            aria-label="Nuova partita"
            title="Nuova partita"
            onClick={() => setEditingMatchDetails(null)}
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
      </div>

      {saveError && !editingMatch && editingMatchDetails === undefined && (
        <p className="agenda-empty courts-error">Errore Supabase: {saveError}</p>
      )}

      {loadError ? (
        <p className="agenda-empty">Errore Supabase: {loadError}</p>
      ) : scheduleRows.length === 0 ? (
        <p className="agenda-empty">Nessuna partita programmata.</p>
      ) : (
        <>
          <div className="courts-grid" style={{ '--court-count': courts.length + (hasLunches ? 1 : 0) } as React.CSSProperties}>
            <div className="courts-grid-header courts-grid-time-header">Ora</div>
            {courts.map((court) => (
              <div key={court.codice} className="courts-grid-header">
                {court.nome}
              </div>
            ))}
            {hasLunches && <div className="courts-grid-header courts-lunch-header">Pranzo</div>}
            {scheduleDays.map((day) => (
              <div key={day.key} className="courts-day-group">
                {hasMultipleScheduleDays && <div className="courts-day-heading">{day.label}</div>}
                {day.rows.map((row) => (
                  <div key={row.time} className="courts-grid-row">
                    <div className="courts-time-cell">{formatTime(row.time)}</div>
                    {courts.map((court) => (
                      <div key={`${row.time}-${court.codice}`} className="courts-match-cell">
                        {(() => {
                          const match = row.matchesByCourt.get(court.codice) ?? null;
                          return (
                            <MatchCell
                              match={match}
                              sets={match ? setsByMatch[match.partita_id] ?? [] : []}
                              canEdit={canEdit}
                              onEditResult={setEditingMatch}
                              onEditMatch={setEditingMatchDetails}
                            />
                          );
                        })()}
                      </div>
                    ))}
                    {hasLunches && (
                      <div className="courts-match-cell">
                        <LunchCell lunches={row.lunches} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="courts-mobile-list">
            {scheduleDays.map((day) => (
              <div key={day.key} className="courts-mobile-day">
                {hasMultipleScheduleDays && <h3>{day.label}</h3>}
                {day.rows.map((row) => (
                  <section key={row.time} className="courts-mobile-slot">
                    <h3>{formatTime(row.time)}</h3>
                    <div className="courts-mobile-cards">
                      {courts.map((court) => (
                        <div key={`${row.time}-${court.codice}`} className="courts-mobile-court">
                          <strong>{court.nome}</strong>
                          {(() => {
                            const match = row.matchesByCourt.get(court.codice) ?? null;
                            return (
                              <MatchCell
                                match={match}
                                sets={match ? setsByMatch[match.partita_id] ?? [] : []}
                                canEdit={canEdit}
                                onEditResult={setEditingMatch}
                                onEditMatch={setEditingMatchDetails}
                              />
                            );
                          })()}
                        </div>
                      ))}
                      {row.lunches.length > 0 && (
                        <div className="courts-mobile-court">
                          <strong>Pranzo</strong>
                          <LunchCell lunches={row.lunches} />
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      {(editingMatch || editingMatchDetails !== undefined) && createPortal(editorPortal, document.body)}
    </div>
  );
}
