import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { errorMessage, isAbortError } from '../api/client'

export type ResourceLoader<T> = (signal: AbortSignal) => Promise<T>

export interface ApiResource<T> {
  data: T | null
  /** True only until the first response (success or error) arrives. */
  loading: boolean
  error: string | null
  reload: () => void
  setData: Dispatch<SetStateAction<T | null>>
}

/**
 * Loads a resource on mount and whenever `refreshKey` changes. Previous data stays
 * visible during background refreshes, in-flight requests are aborted on unmount,
 * and abort errors are never reported as failures.
 *
 * `loader` must be referentially stable (module-level function or useCallback).
 */
export function useApiResource<T>(loader: ResourceLoader<T>, refreshKey: unknown = null): ApiResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    loader(controller.signal)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return
        setError(errorMessage(reason, 'Request failed'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [loader, refreshKey, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { data, loading, error, reload, setData }
}
