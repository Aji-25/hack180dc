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
        <div className="relative" ref={wrapRef}>
            <div className="search-wrap">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-text-tertiary pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={local}
                    onChange={handleChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search saves..."
                    className="search-input"
                />
                {local ? (
                    <button
                        onClick={clear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                ) : (
                    <span className="kbd absolute right-3 top-1/2 -translate-y-1/2">/</span>
                )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && !local && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-bg-raised border border-border rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-border-subtle">
                        <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                            Suggestions
                        </span>
                    </div>
                    <div className="py-1">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => selectSuggestion(s)}
                                className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
