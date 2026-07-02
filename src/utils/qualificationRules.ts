export type QualificationVariant = 'gold' | 'silver' | 'qualified';

export interface QualificationRule {
  minPosition: number;
  maxPosition: number;
  label: string;
  variant: QualificationVariant;
  phaseCode?: string;
}

interface TournamentPhase {
  codice: string;
  nome: string;
  tipo: string;
}

function normalizeVariant(value: unknown): QualificationVariant {
  if (value === 'gold' || value === 'silver' || value === 'qualified') return value;
  return 'qualified';
}

function normalizeRule(value: unknown): QualificationRule | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as {
    minPosition?: unknown;
    maxPosition?: unknown;
    label?: unknown;
    variant?: unknown;
    phaseCode?: unknown;
  };
  const maxPosition = Number(raw.maxPosition);
  const minPosition = raw.minPosition === undefined ? 1 : Number(raw.minPosition);

  if (!Number.isInteger(minPosition) || !Number.isInteger(maxPosition)) return null;
  if (minPosition < 1 || maxPosition < minPosition) return null;

  const variant = normalizeVariant(raw.variant);
  return {
    minPosition,
    maxPosition,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : 'Qualificata',
    variant,
    phaseCode: typeof raw.phaseCode === 'string' && raw.phaseCode.trim() ? raw.phaseCode.trim() : undefined
  };
}

export function parseQualificationRules(value: unknown): QualificationRule[] {
  if (!value || typeof value !== 'object') return [];

  const raw = value as { groupQualifications?: unknown };
  if (!Array.isArray(raw.groupQualifications)) return [];

  return raw.groupQualifications
    .map(normalizeRule)
    .filter((rule): rule is QualificationRule => Boolean(rule))
    .sort((a, b) => a.minPosition - b.minPosition || a.maxPosition - b.maxPosition);
}

export function getFallbackQualificationRules(phases: TournamentPhase[]): QualificationRule[] {
  const phaseCodes = new Set(phases.map((phase) => phase.codice));

  if (phaseCodes.has('GOLD') && phaseCodes.has('SILVER')) {
    return [
      { minPosition: 1, maxPosition: 2, label: 'Gold', variant: 'gold', phaseCode: 'GOLD' },
      { minPosition: 3, maxPosition: 4, label: 'Silver', variant: 'silver', phaseCode: 'SILVER' }
    ];
  }

  if (phaseCodes.has('TORNEO')) {
    return [{ minPosition: 1, maxPosition: 2, label: 'Qualificata', variant: 'qualified', phaseCode: 'TORNEO' }];
  }

  return [];
}

export function getQualificationRule(position: number | null, rules: QualificationRule[]) {
  if (position === null) return null;
  return rules.find((rule) => position >= rule.minPosition && position <= rule.maxPosition) ?? null;
}
