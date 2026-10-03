import { useCallback, useEffect, useState } from 'react'

export function useApiResource(load, resourceKey, { enabled = true } = {}) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)
  const key = `${resourceKey}:${revision}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    load({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data, error: null })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ key, data: null, error })
    })
    return () => controller.abort()
  }, [load, key, enabled])

  const current = result?.key === key ? result : null
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  const update = useCallback((data) => setResult({ key, data, error: null }), [key])

  return { data: current?.data, error: current?.error, loading: enabled && !current, retry, update }
}
