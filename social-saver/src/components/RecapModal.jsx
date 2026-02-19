import { useState } from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'

// Mock recap for local dev
const MOCK_RECAP = {
    recap: [
        "You saved 9 links this week: 2 Fitness, 1 Food, 1 Coding, 1 Travel, 1 Design, 1 Business, 1 Self-Improvement, 1 Other.",
        "Top themes: workouts (core + resistance bands), quick recipes, React patterns.",
        "Interesting pattern: you seem to save a lot of short-form fitness content — building a routine?",
        "Try next: search for 'high-protein meal prep' or 'React server components' to deepen your top interests.",
        "Keep it up — consistency beats intensity. Your link library is growing! 🔥"
    ],
    count: 9,
    period: "This week"
}

export default function RecapModal({ userPhone, useMock }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [recap, setRecap] = useState(null)

    const fetchRecap = async () => {
        setLoading(true)
        setOpen(true)

        if (useMock) {
            // Simulate API delay
            await new Promise(r => setTimeout(r, 800))
            setRecap(MOCK_RECAP)
            setLoading(false)
            return
        }

        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/weekly-recap?phone=${encodeURIComponent(userPhone)}`)
            const data = await res.json()
            setRecap(data)
        } catch (err) {
            console.error('Recap error:', err)
            setRecap(MOCK_RECAP) // fallback
        }
        setLoading(false)
    }

    return (
        <>
            <button onClick={fetchRecap} className="btn btn-ghost">
                <Sparkles className="w-3.5 h-3.5" />
                Weekly Recap
            </button>

            {open && (
                <div className="overlay" onClick={() => setOpen(false)}>
                    <div className="modal p-6 mx-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" style={{ color: '#ff8c42' }} />
                                <span className="text-[14px] font-semibold">
                                    {recap?.period || 'Weekly'} Recap
                                    {recap?.count ? ` — ${recap.count} saves` : ''}
                                </span>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-secondary">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-text-tertiary">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-[13px]">Generating your recap...</span>
                            </div>
                        ) : recap?.recap ? (
                            <ul className="space-y-3">
                                {recap.recap.map((bullet, i) => (
                                    <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
                                        <span className="text-text-tertiary font-mono text-[11px] mt-0.5 shrink-0">
                                            {i + 1}.
                                        </span>
                                        <span className="text-text-secondary">{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[13px] text-text-tertiary text-center py-4">
                                No recap data available.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
