import type { DocumentStatus, EvalRunStatus, FaithfulnessVerdict, RiskLevel } from '../types'

export interface BadgeStyle {
  label: string
  className: string
  /** Whether the badge should show a pulsing indicator (in-progress states). */
  pulse?: boolean
}

const DOCUMENT_STATUS: Record<DocumentStatus, BadgeStyle> = {
  processing: {
    label: 'Processing',
    className: 'bg-[var(--color-status-processing-soft)] text-[var(--color-status-processing)]',
    pulse: true,
  },
  ready: {
    label: 'Ready',
    className: 'bg-[var(--color-status-ready-soft)] text-[var(--color-status-ready)]',
  },
  failed: {
    label: 'Failed',
    className: 'bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]',
  },
}

export function documentStatusBadge(status: DocumentStatus): BadgeStyle {
  return DOCUMENT_STATUS[status] ?? DOCUMENT_STATUS.processing
}

const EVAL_RUN_STATUS: Record<EvalRunStatus, BadgeStyle> = {
  running: {
    label: 'Running',
    className: 'bg-[var(--color-status-processing-soft)] text-[var(--color-status-processing)]',
    pulse: true,
  },
  complete: {
    label: 'Complete',
    className: 'bg-[var(--color-status-ready-soft)] text-[var(--color-status-ready)]',
  },
  failed: {
    label: 'Failed',
    className: 'bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]',
  },
}

/** An EvalRun without a terminal status yet is treated as "running" until its
 *  metrics are populated (SPEC: metrics arrive once the async run finishes). */
export function evalRunStatusBadge(
  status: EvalRunStatus | undefined,
  hitRate: number | null,
): BadgeStyle {
  if (status) return EVAL_RUN_STATUS[status]
  return hitRate === null || hitRate === undefined
    ? EVAL_RUN_STATUS.running
    : EVAL_RUN_STATUS.complete
}

const RISK_LEVEL: Record<RiskLevel, BadgeStyle> = {
  low: {
    label: 'Low risk',
    className: 'bg-[var(--color-risk-low-soft)] text-[var(--color-risk-low-ink)]',
  },
  medium: {
    label: 'Medium risk',
    className: 'bg-[var(--color-risk-medium-soft)] text-[var(--color-risk-medium-ink)]',
  },
  high: {
    label: 'High risk',
    className: 'bg-[var(--color-risk-high-soft)] text-[var(--color-risk-high-ink)]',
  },
}

export function riskBadge(level: RiskLevel): BadgeStyle {
  return RISK_LEVEL[level] ?? RISK_LEVEL.medium
}

const VERDICT: Record<FaithfulnessVerdict, BadgeStyle> = {
  faithful: {
    label: 'Faithful',
    className: 'bg-[var(--color-verdict-faithful-soft)] text-[var(--color-verdict-faithful)]',
  },
  partial: {
    label: 'Partial',
    className: 'bg-[var(--color-verdict-partial-soft)] text-[var(--color-verdict-partial)]',
  },
  unfaithful: {
    label: 'Unfaithful',
    className: 'bg-[var(--color-verdict-unfaithful-soft)] text-[var(--color-verdict-unfaithful)]',
  },
}

export function verdictBadge(verdict: FaithfulnessVerdict): BadgeStyle {
  return VERDICT[verdict] ?? VERDICT.partial
}
