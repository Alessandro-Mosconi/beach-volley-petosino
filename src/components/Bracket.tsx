import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';

interface BracketProps {
  faseName: string;
  tournamentId: number;
  canEdit: boolean;
}

interface MatchData {
  id: number;
  slot_tabellone: string | null;
  squadra_1_codice: string | null;
  squadra_2_codice: string | null;
  squadra_1_nome: string;
  squadra_2_nome: string;
  setWins1: number;
  setWins2: number;
  winner: string | null;
  orario_inizio: string | null;
  campo_codice: string | null;
  campo_nome: string;
  squadra_arbitro_codice: string | null;
  stato: string;
  note: string | null;
}

interface BracketSlot extends MatchData {
  slotIndex: number;
}

type BracketViewMode = 'diagram' | 'cards';

interface TeamOption {
  codice: string;
  nome: string;
}

interface CourtOption {
  codice: string;
  nome: string;
}

interface MatchSet {
  id: number;
  partita_id: number;
  numero_set: number;
  punteggio_squadra_1: number;
  punteggio_squadra_2: number;
}

interface SetDraft {
  numero_set: number;
  punteggio_squadra_1: string;
  punteggio_squadra_2: string;
}

const BRACKET_ROUNDS = [
  { title: 'Quarti', slotIndexes: [0, 1, 2, 3] },
  { title: 'Semifinali', slotIndexes: [4, 5] },
  { title: 'Finali', slotIndexes: [6, 7] }
];

const GRAPH_NODES_COMPACT = [
  { slotIndex: 0, round: 'Quarto 1', x: 32, y: 24 },
  { slotIndex: 1, round: 'Quarto 2', x: 32, y: 198 },
  { slotIndex: 2, round: 'Quarto 3', x: 32, y: 372 },
  { slotIndex: 3, round: 'Quarto 4', x: 32, y: 546 },
  { slotIndex: 4, round: 'Semifinale 1', x: 360, y: 111 },
  { slotIndex: 5, round: 'Semifinale 2', x: 360, y: 459 },
  { slotIndex: 6, round: 'Finale', x: 688, y: 198 },
  { slotIndex: 7, round: 'Finalina', x: 688, y: 459 }
];

const GRAPH_EDGES_COMPACT = [
  { from: 0, to: 4, path: 'M 256 96 H 306 V 183 H 360' },
  { from: 1, to: 4, path: 'M 256 270 H 306 V 183 H 360' },
  { from: 2, to: 5, path: 'M 256 444 H 306 V 531 H 360' },
  { from: 3, to: 5, path: 'M 256 618 H 306 V 531 H 360' },
  { from: 4, to: 6, path: 'M 584 183 H 634 V 270 H 688' },
  { from: 5, to: 6, path: 'M 584 531 H 634 V 270 H 688' }
];

const GRAPH_NODES_EDIT = [
  { slotIndex: 0, round: 'Quarto 1', x: 32, y: 20 },
  { slotIndex: 1, round: 'Quarto 2', x: 32, y: 230 },
  { slotIndex: 2, round: 'Quarto 3', x: 32, y: 440 },
  { slotIndex: 3, round: 'Quarto 4', x: 32, y: 650 },
  { slotIndex: 4, round: 'Semifinale 1', x: 360, y: 125 },
  { slotIndex: 5, round: 'Semifinale 2', x: 360, y: 545 },
  { slotIndex: 6, round: 'Finale', x: 688, y: 230 },
  { slotIndex: 7, round: 'Finalina', x: 688, y: 545 }
];

const GRAPH_EDGES_EDIT = [
  { from: 0, to: 4, path: 'M 256 92 H 306 V 197 H 360' },
  { from: 1, to: 4, path: 'M 256 302 H 306 V 197 H 360' },
  { from: 2, to: 5, path: 'M 256 512 H 306 V 617 H 360' },
  { from: 3, to: 5, path: 'M 256 722 H 306 V 617 H 360' },
  { from: 4, to: 6, path: 'M 584 197 H 634 V 302 H 688' },
  { from: 5, to: 6, path: 'M 584 617 H 634 V 302 H 688' }
];

const SLOT_INDEX_BY_CODE: Record<string, number> = {
  QUARTI_1: 0,
  QUARTI_2: 1,
  QUARTI_3: 2,
  QUARTI_4: 3,
  SEMIFINALE_1: 4,
  SEMIFINALE_2: 5,
  FINALE: 6,
  FINALINA: 7
};

const SLOT_CODE_BY_INDEX = Object.fromEntries(
  Object.entries(SLOT_INDEX_BY_CODE).map(([slotCode, slotIndex]) => [slotIndex, slotCode])
) as Record<number, string>;

function createEmptySlot(slotIndex: number): BracketSlot {
  return {
    id: -100 - slotIndex,
    slotIndex,
    slot_tabellone: null,
    squadra_1_codice: null,
    squadra_2_codice: null,
    squadra_1_nome: '',
    squadra_2_nome: '',
    setWins1: 0,
    setWins2: 0,
    winner: null,
    orario_inizio: null,
    campo_codice: null,
    campo_nome: ''
    ,
    squadra_arbitro_codice: null,
    stato: 'programmata',
    note: null
  };
}

function createSlots(matches: MatchData[]): BracketSlot[] {
  const slots = Array.from({ length: 8 }, (_, index) => createEmptySlot(index));
  const usedSlots = new Set<number>();

  matches.forEach((match) => {
    if (!match.slot_tabellone) return;
    const slotIndex = SLOT_INDEX_BY_CODE[match.slot_tabellone];
    if (slotIndex === undefined) return;
    slots[slotIndex] = { ...match, slotIndex };
    usedSlots.add(slotIndex);
  });

  matches
    .filter((match) => !match.slot_tabellone)
    .slice(0, 8)
    .forEach((match) => {
      const slotIndex = slots.findIndex((slot, index) => slot.id < 0 && !usedSlots.has(index));
      if (slotIndex === -1) return;
      slots[slotIndex] = { ...match, slotIndex };
      usedSlots.add(slotIndex);
  });

  return slots;
}

function fallbackTeams(slotIndex: number) {
  if (slotIndex === 4) return ['Vincente Quarto 1', 'Vincente Quarto 2'];
  if (slotIndex === 5) return ['Vincente Quarto 3', 'Vincente Quarto 4'];
  if (slotIndex === 6) return ['Vincente Semifinale 1', 'Vincente Semifinale 2'];
  if (slotIndex === 7) return ['Perdente Semifinale 1', 'Perdente Semifinale 2'];
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

function toDateTimeInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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

function BracketMatchEditor({
  match,
  teams,
  courts,
  saving,
  error,
  onCancel,
  onDelete,
  onSave
}: {
  match: BracketSlot;
  teams: TeamOption[];
  courts: CourtOption[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (values: {
    id: number;
    slotIndex: number;
    campo_codice: string;
    orario_inizio: string;
    squadra_1_codice: string;
    squadra_2_codice: string;
    squadra_arbitro_codice: string | null;
    stato: string;
    note: string | null;
  }) => void;
}) {
  const [campo, setCampo] = useState(match.campo_codice ?? courts[0]?.codice ?? '');
  const [orario, setOrario] = useState(toDateTimeInputValue(match.orario_inizio));
  const [squadra1, setSquadra1] = useState(match.squadra_1_codice ?? teams[0]?.codice ?? '');
  const [squadra2, setSquadra2] = useState(match.squadra_2_codice ?? teams[1]?.codice ?? teams[0]?.codice ?? '');
  const [arbitro, setArbitro] = useState(match.squadra_arbitro_codice ?? '');
  const [stato, setStato] = useState(match.stato ?? 'programmata');
  const [note, setNote] = useState(match.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="result-editor-backdrop" role="presentation">
      <form
        className="result-editor bracket-editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: match.id,
            slotIndex: match.slotIndex,
            campo_codice: campo,
            orario_inizio: orario,
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
            <span>{GRAPH_NODES_COMPACT.find((node) => node.slotIndex === match.slotIndex)?.round}</span>
            <h3>{match.id > 0 ? 'Modifica partita' : 'Crea partita'}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Chiudi">
            X
          </button>
        </div>

        <div className="match-editor-grid">
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
          {match.id > 0 && !confirmDelete && (
            <button type="button" className="bracket-delete-btn" onClick={() => setConfirmDelete(true)} disabled={saving}>
              Elimina
            </button>
          )}
          {confirmDelete && (
            <div className="bracket-delete-confirm">
              <span>Confermi l'eliminazione?</span>
              <button type="button" className="bracket-delete-btn" onClick={onDelete} disabled={saving}>
                Sì, elimina
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving}>
                Annulla
              </button>
            </div>
          )}
          {!confirmDelete && (
            <>
              <button type="button" onClick={onCancel} disabled={saving}>
                Annulla
              </button>
              <button type="submit" disabled={saving}>
                Salva partita
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function BracketResultEditor({
  match,
  sets,
  saving,
  error,
  onCancel,
  onSave
}: {
  match: BracketSlot;
  sets: MatchSet[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (drafts: SetDraft[], stato: string) => void;
}) {
  const [drafts, setDrafts] = useState<SetDraft[]>(() => createSetDrafts(sets));
  const [stato, setStato] = useState(match.stato ?? 'programmata');

  const updateDraft = (numeroSet: number, field: keyof Omit<SetDraft, 'numero_set'>, value: string) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.numero_set === numeroSet ? { ...draft, [field]: value.replace(/[^\d]/g, '') } : draft
      )
    );
  };

  const addSet = () => {
    setDrafts((currentDrafts) => [
      ...currentDrafts,
      { numero_set: currentDrafts.length + 1, punteggio_squadra_1: '0', punteggio_squadra_2: '0' }
    ]);
  };

  const removeSet = (numeroSet: number) => {
    setDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts
        .filter((draft) => draft.numero_set !== numeroSet)
        .map((draft, index) => ({ ...draft, numero_set: index + 1 }));
      return nextDrafts.length > 0
        ? nextDrafts
        : [{ numero_set: 1, punteggio_squadra_1: '', punteggio_squadra_2: '' }];
    });
  };

  const stepDraft = (numeroSet: number, field: keyof Omit<SetDraft, 'numero_set'>, delta: number) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.numero_set !== numeroSet) return draft;
        const nextValue = Math.max(0, Number(draft[field] || 0) + delta);
        return { ...draft, [field]: String(nextValue) };
      })
    );
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
            <span>{GRAPH_NODES_COMPACT.find((node) => node.slotIndex === match.slotIndex)?.round}</span>
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
                  />
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_1', 1)}>+</button>
                </div>
                <div className="score-stepper">
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_2', -1)}>-</button>
                  <input
                    inputMode="numeric"
                    value={draft.punteggio_squadra_2}
                    onChange={(event) => updateDraft(draft.numero_set, 'punteggio_squadra_2', event.target.value)}
                  />
                  <button type="button" onClick={() => stepDraft(draft.numero_set, 'punteggio_squadra_2', 1)}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="add-set-button" type="button" onClick={addSet}>
          Aggiungi set
        </button>

        {error && <p className="result-editor-error">{error}</p>}

        <div className="result-editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
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

export default function Bracket({ faseName, tournamentId, canEdit }: BracketProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [setsByMatch, setSetsByMatch] = useState<Record<number, MatchSet[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<BracketViewMode>('diagram');
  const [editingMatch, setEditingMatch] = useState<BracketSlot | null>(null);
  const [editingResult, setEditingResult] = useState<BracketSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      const [partiteRes, teamsRes, courtsRes] = await Promise.all([
        supabase
          .from('v_partita_risultato')
          .select(
            'partita_id, slot_tabellone, squadra_1_codice, squadra_1_nome, squadra_2_codice, squadra_2_nome, squadra_arbitro_codice, squadra_vincitrice_codice, orario_inizio, campo_codice, campo_nome, set_vinti_squadra_1, set_vinti_squadra_2, stato, note'
          )
          .eq('torneo_id', tournamentId)
          .eq('fase_torneo_codice', faseName)
          .order('orario_inizio', { ascending: true })
          .order('campo_nome', { ascending: true })
          .order('partita_id', { ascending: true }),
        supabase
          .from('squadra')
          .select('codice, nome')
          .eq('torneo_id', tournamentId)
          .order('nome', { ascending: true }),
        supabase
          .from('campo')
          .select('codice, nome')
          .eq('torneo_id', tournamentId)
          .order('ordine', { ascending: true })
      ]);

      const { data: partite, error: partitaErr } = partiteRes;

      if (partitaErr || !partite || teamsRes.error || courtsRes.error) {
        setMatches([]);
        setTeams([]);
        setCourts([]);
        setSetsByMatch({});
        setLoading(false);
        return;
      }

      const matchData: MatchData[] = partite.map((partita) => ({
        id: partita.partita_id,
        slot_tabellone: partita.slot_tabellone ?? null,
        squadra_1_codice: partita.squadra_1_codice,
        squadra_2_codice: partita.squadra_2_codice,
        squadra_1_nome: partita.squadra_1_nome ?? '',
        squadra_2_nome: partita.squadra_2_nome ?? '',
        setWins1: partita.set_vinti_squadra_1 ?? 0,
        setWins2: partita.set_vinti_squadra_2 ?? 0,
        winner: partita.squadra_vincitrice_codice ?? null,
        orario_inizio: partita.orario_inizio ?? null,
        campo_codice: partita.campo_codice ?? null,
        campo_nome: partita.campo_nome ?? ''
        ,
        squadra_arbitro_codice: partita.squadra_arbitro_codice ?? null,
        stato: partita.stato ?? 'programmata',
        note: partita.note ?? null
      }));

      const matchIds = matchData.map((match) => match.id);
      const setsRes = matchIds.length > 0
        ? await supabase
            .from('partita_set')
            .select('id, partita_id, numero_set, punteggio_squadra_1, punteggio_squadra_2')
            .in('partita_id', matchIds)
            .order('numero_set', { ascending: true })
        : { data: [], error: null };

      if (setsRes.error) {
        setSetsByMatch({});
      } else {
        const nextSetsByMatch = ((setsRes.data ?? []) as MatchSet[]).reduce<Record<number, MatchSet[]>>((acc, set) => {
          acc[set.partita_id] = [...(acc[set.partita_id] ?? []), set];
          return acc;
        }, {});
        setSetsByMatch(nextSetsByMatch);
      }

      setMatches(matchData.filter((m) => m.id > 0));
      setTeams((teamsRes.data ?? []) as TeamOption[]);
      setCourts((courtsRes.data ?? []) as CourtOption[]);
      setLoading(false);
    }
    fetchMatches();

    const channel = supabase
      .channel(`bracket-live-${faseName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneo_fase' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partita_set' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squadra' }, () => fetchMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campo' }, () => fetchMatches())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [faseName, tournamentId]);

  const slots = createSlots(matches);

  const saveMatchDetails = async (values: {
    id: number;
    slotIndex: number;
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
      setSaveError('La squadra arbitro non puo essere una delle due squadre in campo.');
      setSaving(false);
      return;
    }

    const payload = {
      torneo_id: tournamentId,
      fase_torneo_codice: faseName,
      girone_codice: null,
      slot_tabellone: SLOT_CODE_BY_INDEX[values.slotIndex],
      campo_codice: values.campo_codice,
      orario_inizio: new Date(values.orario_inizio).toISOString(),
      squadra_1_codice: values.squadra_1_codice,
      squadra_2_codice: values.squadra_2_codice,
      squadra_arbitro_codice: values.squadra_arbitro_codice,
      stato: values.stato,
      note: values.note
    };

    const request = values.id > 0
      ? supabase.from('partita').update(payload).eq('id', values.id)
      : supabase.from('partita').insert(payload);
    const { error } = await request;

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingMatch(null);
  };

  const deleteMatch = async (match: BracketSlot) => {
    if (match.id <= 0) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('partita').delete().eq('id', match.id);
    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingMatch(null);
  };

  const saveResult = async (match: BracketSlot, drafts: SetDraft[], stato: string) => {
    if (match.id <= 0) return;

    setSaving(true);
    setSaveError(null);

    const completeDrafts = drafts.filter((draft) => draft.punteggio_squadra_1 !== '' || draft.punteggio_squadra_2 !== '');
    const incompleteDraft = completeDrafts.find((draft) => draft.punteggio_squadra_1 === '' || draft.punteggio_squadra_2 === '');
    const tiedDraft = completeDrafts.find((draft) => Number(draft.punteggio_squadra_1) === Number(draft.punteggio_squadra_2));

    if (incompleteDraft) {
      setSaveError(`Completa entrambi i punteggi del Set ${incompleteDraft.numero_set}.`);
      setSaving(false);
      return;
    }

    if (tiedDraft) {
      setSaveError(`Il Set ${tiedDraft.numero_set} non puo finire in parita.`);
      setSaving(false);
      return;
    }

    const currentSets = setsByMatch[match.id] ?? [];
    const rowsToUpsert = completeDrafts.map((draft) => ({
      partita_id: match.id,
      numero_set: draft.numero_set,
      punteggio_squadra_1: Number(draft.punteggio_squadra_1),
      punteggio_squadra_2: Number(draft.punteggio_squadra_2),
      squadra_vincitrice_codice:
        Number(draft.punteggio_squadra_1) > Number(draft.punteggio_squadra_2)
          ? match.squadra_1_codice
          : match.squadra_2_codice
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

    const { error: matchError } = await supabase.from('partita').update({ stato }).eq('id', match.id);
    if (matchError) {
      setSaveError(matchError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingResult(null);
  };

  const renderMatchContent = (match: BracketSlot, compact = false) => {
    const [fallbackA, fallbackB] = fallbackTeams(match.slotIndex);
    const teamA = match.squadra_1_nome || fallbackA;
    const teamB = match.squadra_2_nome || fallbackB;
    const showScore = Boolean(match.squadra_1_nome && match.squadra_2_nome);

    return (
      <>
        <div className="bracket-match-heading">
          <span>{GRAPH_NODES_COMPACT.find((node) => node.slotIndex === match.slotIndex)?.round}</span>
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
        {canEdit && (
          <div className="bracket-actions">
            <button type="button" onClick={() => setEditingMatch(match)}>
              {match.id > 0 ? 'Partita' : 'Crea'}
            </button>
            {match.id > 0 && (
              <button type="button" onClick={() => setEditingResult(match)}>
                Risultato
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  const editorPortal = (
    <>
      {editingMatch && (
        <BracketMatchEditor
          match={editingMatch}
          teams={teams}
          courts={courts}
          saving={saving}
          error={saveError}
          onCancel={() => {
            setEditingMatch(null);
            setSaveError(null);
          }}
          onDelete={() => deleteMatch(editingMatch)}
          onSave={saveMatchDetails}
        />
      )}
      {editingResult && (
        <BracketResultEditor
          match={editingResult}
          sets={setsByMatch[editingResult.id] ?? []}
          saving={saving}
          error={saveError}
          onCancel={() => {
            setEditingResult(null);
            setSaveError(null);
          }}
          onSave={(drafts, stato) => saveResult(editingResult, drafts, stato)}
        />
      )}
    </>
  );

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
          

          {viewMode === 'diagram' ? (
            <div className="bracket-graph-scroll">
              <div className={`bracket-graph ${canEdit ? 'bracket-graph--edit' : ''}`}>
                <svg className="bracket-graph-lines" viewBox={canEdit ? '0 0 940 840' : '0 0 940 714'} preserveAspectRatio="none">
                  {(canEdit ? GRAPH_EDGES_EDIT : GRAPH_EDGES_COMPACT).map((edge) => {
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

                {(canEdit ? GRAPH_NODES_EDIT : GRAPH_NODES_COMPACT).map((node) => {
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
      {(editingMatch || editingResult) && createPortal(editorPortal, document.body)}
    </div>
  );
}
