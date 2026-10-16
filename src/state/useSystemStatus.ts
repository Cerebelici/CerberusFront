import { useContext } from 'react'
import { SystemStatusContext, type SystemStatusContextValue } from './systemStatusContext'

export function useSystemStatus(): SystemStatusContextValue {
  const value = useContext(SystemStatusContext)
  if (!value) {
    throw new Error('useSystemStatus must be used inside <SystemStatusProvider>')
  }
  return value
}
