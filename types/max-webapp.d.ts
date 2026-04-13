/** MAX Bridge — глобальный window.WebApp (не путать с Telegram.WebApp). */

export type MaxDeviceStorageResult = {
  status?: string
  key?: string
  value?: string
}

export type MaxWebAppBridge = {
  initData: string
  initDataUnsafe?: {
    start_param?: string
    [key: string]: unknown
  }
  DeviceStorage?: {
    setItem(key: string, value: string): Promise<MaxDeviceStorageResult>
    getItem(key: string): Promise<MaxDeviceStorageResult | null>
    removeItem?(key: string): Promise<MaxDeviceStorageResult>
    clear?(): Promise<MaxDeviceStorageResult>
  }
  ready?: () => void
  expand?: () => void
}

declare global {
  interface Window {
    /** MAX мини-приложение (bridge). */
    WebApp?: MaxWebAppBridge
  }
}

export {}
