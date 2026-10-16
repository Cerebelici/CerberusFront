// Public surface of the scan feature. Everything scan-related (API callers, trigger
// lifecycle, status indicator, history table, page) lives in this folder.
export { default as ScanPage } from './ScanPage'
export { default as ScanStatusIndicator } from './ScanStatusIndicator'
export { default as TriggerScanButton } from './TriggerScanButton'
export { useTriggerScan } from './useTriggerScan'
export { triggerScan, fetchScanHistory } from './scanApi'
export type { ScanType, ScanLogDTO, TriggerPhase, TriggerState } from './scanTypes'
