import type { UserRole } from '../types'

interface JwtPayload {
  role?: UserRole
  sub?: string
  email?: string
  org_id?: number
  [key: string]: unknown
}

/**
 * Decodes a JWT's payload without verifying its signature — for UI-only
 * concerns (e.g. showing/hiding the Admin nav link). The API is the actual
 * enforcement point for role-gated routes; this is just a display hint.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const json = atob(padded)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function roleFromToken(token: string | null): UserRole | null {
  if (!token) return null
  return decodeJwtPayload(token)?.role ?? null
}
