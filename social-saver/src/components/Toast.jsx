import { createContext, useContext, useState, useCallback } from 'react'
import { Check, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
    }

    const icons = {
        success: <Check className="w-3.5 h-3.5 text-green shrink-0" />,
        error: <AlertCircle className="w-3.5 h-3.5 text-red shrink-0" />,
        info: <Info className="w-3.5 h-3.5 shrink-0 text-[var(--color-accent)]" />,
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        {icons[t.type]}
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
