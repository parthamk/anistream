
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const styles = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-400'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-400'
  },
  info: {
    icon: Info,
    color: 'text-brand-400'
  }
}

export default function Toast() {
  const { toasts, dismissToast } = useToast()

  return (
    <div
      className="fixed bottom-5 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const config = styles[toast.type] || styles.info
        const Icon = config.icon

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-dark-800 p-4 shadow-2xl"
          >
            <Icon
              size={20}
              className={`mt-0.5 shrink-0 ${config.color}`}
            />

            <p className="flex-1 text-sm leading-relaxed text-zinc-200">
              {toast.message}
            </p>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
