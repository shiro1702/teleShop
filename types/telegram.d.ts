declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        initData: string
        initDataUnsafe?: {
          start_param?: string
          [key: string]: unknown
        }
        MainButton: {
          text: string
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
          showProgress: (show?: boolean) => void
        }
        showAlert: (message: string) => void
        close: () => void
      }
    }
  }
}

export {}
