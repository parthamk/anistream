
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

const ToastContext = createContext(null)

let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id)

    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }

    setToasts((current) =>
      current.filter((toast) => toast.id !== id)
    )
  }, [])

  const showToast = useCallback((
    message,
    type = 'info',
    duration = 3500
  ) => {
    const id = nextToastId++

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        type
      }
    ])

    const timer = setTimeout(() => {
      dismissToast(id)
    }, duration)

    timers.current.set(id, timer)

    return id
  }, [dismissToast])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error(
      'useToast must be used inside a ToastProvider.'
    )
  }

  return context
}
