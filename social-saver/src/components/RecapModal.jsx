import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Loader2, TrendingUp, Calendar, Zap, Award, Target } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { AnimatePresence, motion } from 'framer-motion'

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
            <Button
                onClick={fetchRecap}
                variant="secondary"
                size="sm"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-[#f0f0ff] shadow-sm hover:shadow-md transition-all duration-300"
            >
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] mr-2" />
                Weekly Recap
            </Button>

            {createPortal(
                <AnimatePresence>
                    {open && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setOpen(false)}
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.2 }}
                                className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl shadow-[var(--color-accent)]/10"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Decorative background gradients */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent)]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-accent-2)]/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                                {/* Header */}
                                <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#161616]/80 backdrop-blur-xl z-20">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent-2)]/20 border border-white/10 shadow-inner">
                                            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold tracking-tight text-white">
                                                {recap?.period || 'Weekly'} Recap
                                            </h2>
                                            <p className="text-xs font-medium text-white/40">
                                                Your second brain activity analysis
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => setOpen(false)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-white/40 hover:text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="p-6 relative z-10 min-h-[300px] max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    {loading ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
                                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                                            <span className="text-xs font-medium">Analyzing your saves...</span>
                                        </div>
                                    ) : recap ? (
                                        <div className="space-y-6">
                                            {/* Stats Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                                    <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                                                        {recap.count}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 mt-1">Total Saves</span>
                                                </div>
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                    <TrendingUp className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Most Active</span>
                                                    <span className="text-xs font-bold text-white/80 mt-1">Fitness & Food</span>
                                                </div>
                                            </div>

                                            {/* Insights List */}
                                            <div className="space-y-3">
                                                {parsedInsights.map((item, i) => {
                                                    const Icon = item.icon
                                                    return (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.1 }}
                                                            key={i}
                                                            className="flex gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-colors group"
                                                        >
                                                            <div className="mt-0.5 shrink-0">
                                                                <Icon className="w-4 h-4 text-white/30 group-hover:text-[var(--color-accent)] transition-colors" />
                                                            </div>
                                                            <p className="text-xs leading-relaxed text-white/60 group-hover:text-white/90 transition-colors">
                                                                {item.text}
                                                            </p>
                                                        </motion.div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
                                            <Calendar className="w-8 h-8 opacity-20" />
                                            <p className="text-xs">No recap data available yet.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer decorative line */}
                                <div className="h-1 w-full bg-gradient-to-r from-transparent via-[var(--color-accent)]/20 to-transparent absolute bottom-0" />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
