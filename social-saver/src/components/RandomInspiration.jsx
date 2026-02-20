import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Shuffle, X, ArrowUpRight, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/Button'
import { AnimatePresence, motion } from 'framer-motion'

export default function RandomInspiration({ userPhone }) {
    const [item, setItem] = useState(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    const fetchRandom = async () => {
        setLoading(true)
        if (!open) setOpen(true)

        try {
            let countQuery = supabase
                .from('saves')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'complete')

            if (userPhone) countQuery = countQuery.eq('user_phone', userPhone)

            const { count } = await countQuery
            if (count && count > 0) {
                const offset = Math.floor(Math.random() * count)
                let q = supabase.from('saves').select('*').eq('status', 'complete').range(offset, offset)
                if (userPhone) q = q.eq('user_phone', userPhone)
                const { data } = await q
                if (data?.[0]) {
                    setItem(data[0])
                }
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    return (
        <>
            <Button
                onClick={fetchRandom}
                disabled={loading}
                className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] text-white shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-[var(--color-accent)]/40 hover:scale-[1.02] transition-all duration-300 border-none"
            >
                <Shuffle className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Picking...' : 'Surprise me'}
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
                                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl shadow-[var(--color-accent)]/10"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Decorative background gradients */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent)]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-accent-2)]/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                                {/* Header */}
                                <div className="flex items-center justify-between p-5 border-b border-white/5 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                                        <span className="text-sm font-bold text-white">Random Pick</span>
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
                                <div className="p-6 relative z-10 min-h-[200px] flex flex-col">
                                    {loading && !item ? (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/40 py-8">
                                            <Shuffle className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                                            <span className="text-xs font-medium">Finding a gem...</span>
                                        </div>
                                    ) : item ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col h-full"
                                        >
                                            {/* Category Badge */}
                                            <div className="mb-4">
                                                <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold tracking-wider uppercase text-[var(--color-accent)]">
                                                    {item.category}
                                                </span>
                                            </div>

                                            {/* Title & Summary */}
                                            <h3 className="text-lg font-bold text-white leading-tight mb-2">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-white/60 leading-relaxed mb-6">
                                                {item.summary}
                                            </p>

                                            {/* Tags */}
                                            {item.tags?.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-8">
                                                    {item.tags.map((t, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-0.5 rounded text-[11px] bg-white/[0.03] text-white/40 border border-white/5"
                                                        >
                                                            #{t}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-3 mt-auto pt-6 border-t border-white/5">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1"
                                                >
                                                    <Button className="w-full bg-white text-black hover:bg-gray-100 border-none shadow-lg shadow-white/5 font-semibold">
                                                        Open Link <ArrowUpRight className="ml-2 w-3.5 h-3.5" />
                                                    </Button>
                                                </a>
                                                <Button
                                                    onClick={fetchRandom}
                                                    disabled={loading}
                                                    variant="secondary"
                                                    className="bg-white/5 hover:bg-white/10 border-white/10 text-white"
                                                >
                                                    <Shuffle className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="text-center py-8 text-white/40 text-sm">
                                            Nothing saved yet!
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
