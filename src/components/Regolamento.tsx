import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';

interface RuleSection {
  eyebrow?: string;
  title: string;
  variant?: string;
  listType?: 'ul' | 'ol';
  items: string[];
}

interface RulesContent {
  title?: string;
  sections: RuleSection[];
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const SECTION_VARIANTS = [
  { value: '', label: 'Base', swatch: 'rules-swatch-base' },
  { value: 'primary', label: 'Azzurro', swatch: 'rules-swatch-primary' },
  { value: 'gold', label: 'Gold', swatch: 'rules-swatch-gold' },
  { value: 'silver', label: 'Silver', swatch: 'rules-swatch-silver' }
] as const;

const DEFAULT_RULES: RulesContent = {
  title: 'Regolamento',
  sections: [
    {
      eyebrow: 'Fase iniziale',
      title: 'Gironi',
      variant: 'primary',
      items: [
        'Il torneo prevede 4 gironi da 5 squadre.',
        'Le partite dei gironi si giocano su 2 set al 15.',
        'Non e previsto tie-break nella fase a gironi.',
        'Ogni set vinto vale 1 punto in classifica.',
        'Una partita finita 1-1 assegna quindi 1 punto a entrambe le squadre.',
        'Le prime 2 squadre di ogni girone accedono al tabellone Gold.',
        'La 3a e la 4a squadra di ogni girone accedono al tabellone Silver.'
      ]
    },
    {
      eyebrow: 'Classifica',
      title: 'Criteri di ordinamento',
      listType: 'ol',
      items: ['Punti classifica', 'Scontro diretto tra squadre a pari punti', 'Differenza punti fatti/subiti']
    },
    {
      eyebrow: 'Tabellone',
      title: 'Gold',
      variant: 'gold',
      items: [
        'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
        'Quarti e semifinali: 2 set al 21 con eventuale tie-break al 15.',
        'Finale e finalina: 2 set al 25 con eventuale tie-break al 15.'
      ]
    },
    {
      eyebrow: 'Tabellone',
      title: 'Silver',
      variant: 'silver',
      items: [
        'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
        'Quarti e semifinali: 1 set al 21.',
        'Finale: 2 set al 21 con eventuale tie-break al 15.',
        'Finalina: 1 set al 25.'
      ]
    },
    {
      eyebrow: 'Orari',
      title: 'Prima della partita',
      items: [
        'Presentarsi nella zona dei campi qualche minuto prima dell\'orario previsto.',
        'Non iniziare la partita prima dell\'orario previsto.'
      ]
    },
    {
      eyebrow: 'Arbitraggio',
      title: 'Auto-arbitraggio',
      items: [
        'La fase a gironi si svolge in auto-arbitraggio: ogni squadra arbitrera una o due partite di altre squadre.',
        'Prima della partita da arbitrare va ritirato all\'INFO POINT il foglio per l\'arbitraggio.',
        'Il foglio va riconsegnato all\'INFO POINT a partita finita.',
        'Le fasi finali saranno arbitrate dagli organizzatori del torneo.'
      ]
    },
    {
      eyebrow: 'Gironi',
      title: 'Regole di arbitraggio',
      items: [
        'Fischiare tassativamente invasioni, tetto e linea pestata in battuta.',
        'Fischiare le accompagnate solo se troppo evidenti; in linea di massima lasciare correre dove si puo.',
        'Non fischiare doppie, pallonetti e palleggi in nessuna situazione.'
      ]
    },
    {
      eyebrow: 'Servizi',
      title: 'Pranzo e ghiacciolo',
      items: [
        'All\'orario assegnato per il pranzo, recarsi alla cucina e consegnare il biglietto del pranzo.',
        'La bevanda si ritira alla postazione dedicata consegnando il biglietto della bevanda.',
        'La cucina apre alle 12:00 ed e possibile acquistare piatti extra ordinando al momento.',
        'Ogni squadra avra almeno 45 minuti a disposizione per pranzare.',
        'Il ghiacciolo si ritira al bar in qualsiasi momento consegnando il biglietto del ghiacciolo.'
      ]
    },
    {
      eyebrow: 'Servizi',
      title: 'Spogliatoi',
      items: [
        'Gli spogliatoi saranno disponibili tutto il giorno.',
        'Per evitare sprechi, fare la doccia solo dopo aver terminato tutte le proprie partite.'
      ]
    }
  ]
};

function isRulesContent(value: unknown): value is RulesContent {
  if (!value || typeof value !== 'object') return false;
  const maybeRules = value as { sections?: unknown };
  return Array.isArray(maybeRules.sections);
}

function sectionClassName(section: RuleSection) {
  const classes = ['rules-card'];
  if (section.variant === 'primary') classes.push('rules-card-primary');
  if (section.variant === 'gold') classes.push('rules-card-gold');
  if (section.variant === 'silver') classes.push('rules-card-silver');
  return classes.join(' ');
}

function cloneRules(rules: RulesContent): RulesContent {
  return {
    title: rules.title ?? 'Regolamento',
    sections: rules.sections.map((section) => ({
      eyebrow: section.eyebrow ?? '',
      title: section.title,
      variant: section.variant ?? '',
      listType: section.listType ?? 'ul',
      items: [...section.items]
    }))
  };
}

function createEmptySection(): RuleSection {
  return {
    eyebrow: '',
    title: 'Nuova sezione',
    variant: '',
    listType: 'ul',
    items: ['']
  };
}

export default function Regolamento({ tournamentId, canEdit }: { tournamentId: number; canEdit: boolean }) {
  const [rules, setRules] = useState<RulesContent>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  // null = closed, -1 = adding new, >= 0 = editing existing
  const [dialogSectionIndex, setDialogSectionIndex] = useState<number | null>(null);
  const [dialogDraft, setDialogDraft] = useState<RuleSection | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchRules() {
      setLoading(true);

      const { data, error } = await supabase
        .from('torneo_regolamento')
        .select('contenuto')
        .eq('torneo_id', tournamentId)
        .maybeSingle();

      if (!error && data && isRulesContent(data.contenuto)) {
        setRules(data.contenuto);
      } else {
        setRules(DEFAULT_RULES);
      }

      setLoading(false);
    }

    fetchRules();

    const channel = supabase
      .channel(`regolamento-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'torneo_regolamento', filter: `torneo_id=eq.${tournamentId}` },
        () => fetchRules()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const openEditDialog = (sectionIndex: number) => {
    const section = rules.sections[sectionIndex];
    setDialogDraft({ ...section, items: [...section.items] });
    setDialogSectionIndex(sectionIndex);
    setEditorError(null);
  };

  const openAddDialog = () => {
    setDialogDraft(createEmptySection());
    setDialogSectionIndex(-1);
    setEditorError(null);
  };

  const closeDialog = () => {
    setDialogSectionIndex(null);
    setDialogDraft(null);
    setEditorError(null);
  };

  const updateDialogSection = (patch: Partial<RuleSection>) => {
    setDialogDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateDialogItem = (itemIndex: number, value: string) => {
    setDialogDraft((prev) =>
      prev ? { ...prev, items: prev.items.map((item, i) => (i === itemIndex ? value : item)) } : prev
    );
  };

  const addDialogItem = () => {
    setDialogDraft((prev) => (prev ? { ...prev, items: [...prev.items, ''] } : prev));
  };

  const removeDialogItem = (itemIndex: number) => {
    setDialogDraft((prev) =>
      prev ? { ...prev, items: prev.items.filter((_, i) => i !== itemIndex) } : prev
    );
  };

  const persistRules = async (nextRules: RulesContent): Promise<boolean> => {
    const { error } = await supabase
      .from('torneo_regolamento')
      .upsert({ torneo_id: tournamentId, contenuto: nextRules }, { onConflict: 'torneo_id' });
    if (error) {
      setEditorError(error.message);
      return false;
    }
    setRules(nextRules);
    return true;
  };

  const saveDialog = async () => {
    if (!dialogDraft) return;
    setSaving(true);
    setEditorError(null);

    const normalizedSection: RuleSection = {
      eyebrow: dialogDraft.eyebrow?.trim() || undefined,
      title: dialogDraft.title.trim(),
      variant: dialogDraft.variant || undefined,
      listType: dialogDraft.listType === 'ol' ? 'ol' : 'ul',
      items: dialogDraft.items.map((i) => i.trim()).filter(Boolean)
    };

    if (!normalizedSection.title || normalizedSection.items.length === 0) {
      setEditorError('Titolo e almeno una regola sono obbligatori.');
      setSaving(false);
      return;
    }

    let nextSections: RuleSection[];
    if (dialogSectionIndex === -1) {
      nextSections = [...rules.sections, normalizedSection];
    } else {
      nextSections = rules.sections.map((s, i) => (i === dialogSectionIndex ? normalizedSection : s));
    }

    const ok = await persistRules({ ...rules, sections: nextSections });
    setSaving(false);
    if (ok) closeDialog();
  };

  const deleteSection = async (sectionIndex: number) => {
    setSaving(true);
    setEditorError(null);
    const nextSections = rules.sections.filter((_, i) => i !== sectionIndex);
    const ok = await persistRules({ ...rules, sections: nextSections });
    setSaving(false);
    if (ok) closeDialog();
  };

  return (
    <div className="rules-view">
      <div className="rules-heading">
        <h2>{rules.title ?? 'Regolamento'}</h2>
        {canEdit && (
          <button className="rules-add-btn" type="button" onClick={openAddDialog} aria-label="Aggiungi card">
            +
          </button>
        )}
      </div>

      {loading ? (
        <p className="agenda-empty">Caricamento regolamento...</p>
      ) : (
        <section className="rules-grid">
          {rules.sections.map((section, sectionIndex) => {
            const ListTag = section.listType === 'ol' ? 'ol' : 'ul';
            return (
              <article key={`${section.eyebrow ?? ''}-${section.title}`} className={sectionClassName(section)}>
                {canEdit && (
                  <button
                    className="rules-card-edit-btn"
                    type="button"
                    onClick={() => openEditDialog(sectionIndex)}
                    aria-label="Modifica card"
                  >
                    <PencilIcon />
                  </button>
                )}
                {section.eyebrow && <span>{section.eyebrow}</span>}
                <h3>{section.title}</h3>
                <ListTag>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ListTag>
              </article>
            );
          })}
        </section>
      )}

      {dialogSectionIndex !== null && dialogDraft && createPortal(
        <div
          className="rules-dialog-overlay"
          onClick={closeDialog}
        >
          <div
            className="rules-dialog"
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rules-dialog-header">
              <h3>{dialogSectionIndex === -1 ? 'Nuova card' : 'Modifica card'}</h3>
              <button type="button" className="rules-dialog-close" onClick={closeDialog} aria-label="Chiudi">
                ✕
              </button>
            </div>

            <div className="rules-dialog-body">
              <div className="rules-editor-fields">
                <label>
                  Etichetta
                  <input
                    value={dialogDraft.eyebrow ?? ''}
                    onChange={(e) => updateDialogSection({ eyebrow: e.target.value })}
                  />
                </label>

                <label>
                  Titolo card
                  <input
                    value={dialogDraft.title}
                    onChange={(e) => updateDialogSection({ title: e.target.value })}
                  />
                </label>

                <label>
                  Tipo lista
                  <select
                    value={dialogDraft.listType ?? 'ul'}
                    onChange={(e) =>
                      updateDialogSection({ listType: e.target.value === 'ol' ? 'ol' : 'ul' })
                    }
                  >
                    <option value="ul">Puntata</option>
                    <option value="ol">Numerata</option>
                  </select>
                </label>
              </div>

              <div className="rules-variant-picker" aria-label="Colore card">
                {SECTION_VARIANTS.map((variant) => (
                  <button
                    key={variant.value || 'base'}
                    type="button"
                    className={`rules-variant-option ${
                      (dialogDraft.variant ?? '') === variant.value ? 'rules-variant-option-active' : ''
                    }`}
                    onClick={() => updateDialogSection({ variant: variant.value })}
                  >
                    <span className={`rules-variant-swatch ${variant.swatch}`} aria-hidden="true" />
                    {variant.label}
                  </button>
                ))}
              </div>

              <div className="rules-editor-items">
                <span>Regole</span>
                {dialogDraft.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="rules-editor-item">
                    <textarea
                      value={item}
                      onChange={(e) => updateDialogItem(itemIndex, e.target.value)}
                    />
                    <button type="button" onClick={() => removeDialogItem(itemIndex)}>
                      Rimuovi
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addDialogItem}>
                  Aggiungi regola
                </button>
              </div>
            </div>

            {editorError && <p className="result-editor-error">Errore: {editorError}</p>}

            <div className="rules-dialog-footer">
              {dialogSectionIndex >= 0 && (
                <button
                  type="button"
                  className="rules-dialog-delete-btn"
                  onClick={() => deleteSection(dialogSectionIndex)}
                  disabled={saving}
                >
                  Elimina
                </button>
              )}
              <div className="rules-dialog-footer-actions">
                <button type="button" onClick={closeDialog} disabled={saving}>
                  Annulla
                </button>
                <button type="button" onClick={saveDialog} disabled={saving}>
                  {saving ? 'Salvataggio…' : 'Salva'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
