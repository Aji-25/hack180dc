import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function SearchBar({ value, onChange, suggestions = [] }) {
    const [local, setLocal] = useState(value)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const timerRef = useRef(null)
    const inputRef = useRef(null)
    const wrapRef = useRef(null)

    useEffect(() => { setLocal(value) }, [value])

    // Keyboard shortcut: / to focus
    useEffect(() => {
        const handler = (e) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault()
                inputRef.current?.focus()
            }
            if (e.key === 'Escape') {
                setShowSuggestions(false)
                inputRef.current?.blur()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleChange = (e) => {
        const val = e.target.value
        setLocal(val)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => onChange(val), 300)
    }

    const clear = () => { setLocal(''); onChange(''); setShowSuggestions(false) }

    const selectSuggestion = (s) => {
        setLocal(s)
        onChange(s)
        setShowSuggestions(false)
    }

    return (
        <div className="relative z-50" ref={wrapRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-[var(--color-accent)] transition-colors pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={local}
                    onChange={handleChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search saves..."
                    className="w-full bg-[#161616] md:bg-[#0e0e1a]/60 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-base text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/50 transition-all shadow-inner shadow-black/20"
                />
                {local ? (
                    <button
                        onClick={clear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                ) : (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <kbd className="hidden sm:inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-[11px] font-medium text-white/20 bg-white/5 border border-white/5 rounded">
                            /
                        </kbd>
                    </div>
                )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && !local && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#161616] border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
                    <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <span className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">
                            Suggestions
                        </span>
                    </div>
                    <div className="p-1.5">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => selectSuggestion(s)}
                                className="w-full text-left px-4 py-3 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all group flex items-center gap-3"
                            >
                                <Search className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-accent)]" />
                                <span className="-ml-7 group-hover:ml-0 transition-all duration-300">{s}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
