// Minimal runtime guards for API payloads. They throw on malformed input so that
// apiRequest() can report an "invalid response" instead of rendering garbage.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function isOptionalTimestamp(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))
}

/** Returns body[field] when it is an array, otherwise throws. */
export function expectArrayField<T>(body: unknown, field: string): T[] {
  if (!isRecord(body) || !Array.isArray(body[field])) {
    throw new TypeError(`Expected an object with an array "${field}" field`)
  }
  return body[field] as T[]
}
