import { useState, useMemo } from 'react'
import { Sparkles, X, Loader2, TrendingUp, Calendar, Zap, Award, Target } from 'lucide-react'

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
            await new Promise(r => setTimeout(r, 1200))
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

    // Parse specific insights if available, or just render list
    const parsedInsights = useMemo(() => {
        if (!recap?.recap) return []
        return recap.recap.map((point, i) => {
            let icon = Target
            if (point.toLowerCase().includes('top themes')) icon = TrendingUp
            if (point.toLowerCase().includes('pattern')) icon = Zap
            if (point.toLowerCase().includes('try next')) icon = Calendar
            if (point.toLowerCase().includes('keep it up')) icon = Award
            return { text: point, icon }
        })
    }, [recap])

    return (
        <>
            <button
                onClick={fetchRecap}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-[13px] font-medium text-text-secondary backdrop-blur-md shadow-lg shadow-black/20"
            >
                <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                Weekly Recap
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setOpen(false)}
                    />

                    <div
                        className="relative w-full max-w-lg bg-[#0F1115]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-accent-primary/5 overflow-hidden transform transition-all scale-100 opacity-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Decorative background gradients */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-secondary/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center border border-white/10 shadow-inner">
                                    <Sparkles className="w-5 h-5 text-accent-primary" />
                                </div>
                                <div>
                                    <h2 className="text-[16px] font-semibold text-white tracking-tight">
                                        {recap?.period || 'Weekly'} Recap
                                    </h2>
                                    <p className="text-[12px] text-text-tertiary">
                                        Your second brain activity analysis
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/5 text-text-tertiary hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 relative z-10 min-h-[300px]">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-tertiary">
                                    <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
                                    <span className="text-[13px] font-medium">Analyzing your saves...</span>
                                </div>
                            ) : recap ? (
                                <div className="space-y-6 animate-fadeIn">
                                    {/* Stats Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[32px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                                                {recap.count}
                                            </span>
                                            <span className="text-[11px] uppercase tracking-wider text-text-tertiary mt-1">Total Saves</span>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 to-transparent" />
                                            <TrendingUp className="w-6 h-6 text-accent-primary mb-2" />
                                            <span className="text-[11px] uppercase tracking-wider text-text-tertiary">Most Active</span>
                                            <span className="text-[13px] font-medium text-text-secondary mt-1">Fitness & Food</span>
                                        </div>
                                    </div>

                                    {/* Insights List */}
                                    <div className="space-y-3">
                                        {parsedInsights.map((item, i) => {
                                            const Icon = item.icon
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors group"
                                                >
                                                    <div className="mt-0.5 shrink-0">
                                                        <Icon className="w-4 h-4 text-text-tertiary group-hover:text-accent-primary transition-colors" />
                                                    </div>
                                                    <p className="text-[13px] leading-relaxed text-text-secondary group-hover:text-text-primary transition-colors">
                                                        {item.text}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                                    <Calendar className="w-8 h-8 opacity-20" />
                                    <p className="text-[13px]">No recap data available yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer decorative line */}
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent-primary/20 to-transparent absolute bottom-0" />
                    </div>
                </div>
            )}
        </>
    )
}
