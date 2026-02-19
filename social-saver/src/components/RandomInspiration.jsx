import { useState } from 'react'
import { Shuffle, X, ArrowUpRight, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
            <button
                onClick={fetchRandom}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-medium text-[13px] shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/40 hover:scale-[1.02] transition-all"
            >
                <Shuffle className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Picking...' : 'Surprise me'}
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setOpen(false)}
                    />

                    <div
                        className="relative w-full max-w-md bg-[#0F1115]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-accent-primary/5 overflow-hidden transform transition-all scale-100 opacity-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Decorative background gradients */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-secondary/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5 relative z-10">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-accent-primary" />
                                <span className="text-[14px] font-semibold text-white">Random Pick</span>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-text-tertiary hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 relative z-10 min-h-[200px] flex flex-col">
                            {loading && !item ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-tertiary py-8">
                                    <Shuffle className="w-8 h-8 animate-spin text-accent-primary" />
                                    <span className="text-[13px]">Finding a gem...</span>
                                </div>
                            ) : item ? (
                                <div className="animate-fadeIn">
                                    {/* Category Badge */}
                                    <div className="mb-4">
                                        <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold tracking-wider uppercase text-accent-primary">
                                            {item.category}
                                        </span>
                                    </div>

                                    {/* Title & Summary */}
                                    <h3 className="text-[18px] font-semibold text-white leading-tight mb-2">
                                        {item.title}
                                    </h3>
                                    <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
                                        {item.summary}
                                    </p>

                                    {/* Tags */}
                                    {item.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-6">
                                            {item.tags.map((t, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 rounded text-[11px] bg-white/[0.03] text-text-tertiary border border-white/5"
                                                >
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3 mt-auto pt-4 border-t border-white/5">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-gray-100 transition-colors shadow-lg shadow-white/5"
                                        >
                                            Open Link <ArrowUpRight className="w-3.5 h-3.5" />
                                        </a>
                                        <button
                                            onClick={fetchRandom}
                                            disabled={loading}
                                            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium text-[13px] transition-colors flex items-center gap-2"
                                        >
                                            <Shuffle className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                            {loading ? '...' : 'Another'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-text-tertiary">
                                    Nothing saved yet!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
