import { documentStatusBadge, evalRunStatusBadge } from '../lib/badges'
import type { DocumentStatus, EvalRunStatus } from '../types'
import { Badge } from './Badge'

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge style={documentStatusBadge(status)} />
}

export function EvalRunStatusBadge({
  status,
  hitRate,
}: {
  status?: EvalRunStatus
  hitRate: number | null
}) {
  return <Badge style={evalRunStatusBadge(status, hitRate)} />
}
