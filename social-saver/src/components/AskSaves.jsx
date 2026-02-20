import { useState, useRef } from 'react'
import { X, ArrowRight, Loader2, Sparkles, ArrowUpRight, Network, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { marked } from 'marked'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

const SOURCE_BADGE = {
    both: { label: 'Graph + Vector', cls: 'bg-purple-500/20 text-purple-400' },
    graph: { label: 'Graph', cls: 'bg-indigo-500/20 text-indigo-400' },
    vector: { label: 'Vector', cls: 'bg-blue-500/20 text-blue-400' },
}

export default function AskSaves({ saves, userPhone }) {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiReply, setAiReply] = useState(null)
    const [citations, setCitations] = useState(null)
    const [retrieval, setRetrieval] = useState(null)
    const [showDebug, setShowDebug] = useState(false)
    const inputRef = useRef(null)

    const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        setAiReply(null)
        setCitations(null)
        setRetrieval(null)
        setShowDebug(false)

        // Client-side fallback when no edge function URL configured
        if (!edgeFnUrl) {
            const q = query.toLowerCase()
            const matches = saves.filter(s => {
                const text = [s.title, s.summary, s.category, s.note, ...(s.tags || [])].filter(Boolean).join(' ').toLowerCase()
                return text.includes(q) || q.split(/\s+/).some(w => w.length > 2 && text.includes(w))
            })
            if (matches.length > 0) {
                setAiReply(`Found **${matches.length}** matching save${matches.length > 1 ? 's' : ''}:\n\n${matches.map(m => `**${m.title || 'Untitled'}** — ${m.summary || ''}`).join('\n\n')}`)
                setCitations(matches.map(m => ({ save_id: m.id, url: m.url, title: m.title || m.summary, source: 'local' })))
            } else {
                setAiReply(`No saves matching **"${query}"**. Try a category like "fitness" or tag like "hiit".`)
            }
            setLoading(false)
            return
        }

        try {
            const res = await fetch(`${edgeFnUrl}/chat-brain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ query, user_phone: userPhone || '' }),
            })
            const data = await res.json()

            if (data.error) throw new Error(data.error)

            setAiReply(data.reply || 'No response generated.')

            // Prefer new citations shape, fall back to legacy references
            const cits = data.citations?.length
                ? data.citations
                : (data.references || []).map(r => ({ save_id: r.id, title: r.title, url: r.url, source: 'vector' }))
            setCitations(cits)
            setRetrieval(data.retrieval || null)
        } catch (err) {
            console.error('[AskSaves]', err)
            setAiReply('Error connecting to brain. Please try again.')
        }
        setLoading(false)
    }

    const clearAll = () => {
        setQuery(''); setAiReply(null); setCitations(null); setRetrieval(null)
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            {/* ── Search input ── */}
            <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] opacity-20 blur transition duration-500 group-hover:opacity-40" />
                <div className="relative flex items-center gap-4 rounded-xl border border-white/10 bg-[#161616]/80 p-2 pl-6 shadow-2xl backdrop-blur-xl transition-all focus-within:border-[var(--color-accent)]/50 focus-within:bg-[#1c1c1c]">
                    <Sparkles className={cn('h-6 w-6 text-[var(--color-accent)]', loading && 'animate-pulse')} />
                    <form onSubmit={handleSearch} className="flex flex-1 items-center gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Ask your second brain anything…"
                            className="flex-1 bg-transparent py-4 text-lg font-medium text-white placeholder-white/20 outline-none"
                        />
                        {query && (
                            <button type="button" onClick={clearAll}
                                className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <Button type="submit" disabled={!query.trim() || loading}
                            className={cn('rounded-lg px-6 py-2.5 font-bold transition-all', !query.trim() ? 'scale-95 opacity-0' : 'scale-100 opacity-100')}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Graph-powered indicator */}
            {retrieval?.neo4j_active && (
                <div className="mt-3 flex items-center justify-center gap-2">
                    <Network className="h-3 w-3 text-purple-400" />
                    <span className="text-[11px] font-medium text-purple-400/80">
                        Graph-RAG active · {retrieval.graph_entities_matched?.length || 0} entities matched
                    </span>
                </div>
            )}

            {/* ── AI Reply ── */}
            <AnimatePresence>
                {aiReply && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="mt-6 overflow-hidden"
                    >
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e1a]/95 shadow-2xl backdrop-blur-xl">
                            <div className="h-1 w-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]" />
                            <div className="p-8">
                                <div className="flex gap-6">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10">
                                        <Sparkles className="h-5 w-5 text-[var(--color-accent-2)]" />
                                    </div>
                                    <div className="flex-1 space-y-6">
                                        {/* Answer */}
                                        <div
                                            className="prose prose-invert max-w-none text-base leading-relaxed text-[#9090b8] prose-strong:text-white prose-p:my-2"
                                            dangerouslySetInnerHTML={{ __html: marked(aiReply) }}
                                        />

                                        {/* Citations */}
                                        {citations?.length > 0 && (
                                            <div className="border-t border-white/5 pt-6">
                                                <div className="mb-4 text-xs font-bold uppercase tracking-wider text-[#5a5a80]">
                                                    Sources used
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {citations.map((cit, i) => {
                                                        const badge = SOURCE_BADGE[cit.source] || SOURCE_BADGE.vector
                                                        return (
                                                            <a key={cit.save_id || i} href={cit.url} target="_blank" rel="noopener noreferrer"
                                                                className="group flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-3 transition-all hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="truncate text-sm font-medium text-[#9090b8] group-hover:text-[#f0f0ff]">
                                                                        {cit.title || cit.url}
                                                                    </p>
                                                                    {cit.matched_entities?.length > 0 && (
                                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                                            {cit.matched_entities.map(e => (
                                                                                <span key={e} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
                                                                                    {e}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-shrink-0 items-center gap-1.5 mt-0.5">
                                                                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase', badge.cls)}>
                                                                        {badge.label}
                                                                    </span>
                                                                    <ArrowUpRight className="h-3.5 w-3.5 text-[#5a5a80] group-hover:text-[#a78bfa]" />
                                                                </div>
                                                            </a>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Why retrieved — collapsible debug panel */}
                                        {retrieval && (
                                            <div className="border-t border-white/5 pt-4">
                                                <button
                                                    onClick={() => setShowDebug(d => !d)}
                                                    className="flex w-full items-center justify-between text-xs text-[#5a5a80] hover:text-white/50 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Network className="h-3.5 w-3.5" />
                                                        Why was this retrieved?
                                                    </span>
                                                    {showDebug ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                </button>

                                                <AnimatePresence>
                                                    {showDebug && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-3 overflow-hidden rounded-lg border border-white/5 bg-white/3 p-4 text-[11px] text-white/40 space-y-2"
                                                        >
                                                            <div>
                                                                <span className="text-white/60 font-semibold">Entities extracted: </span>
                                                                {(retrieval.entities_extracted || []).join(', ') || 'none'}
                                                            </div>
                                                            <div>
                                                                <span className="text-white/60 font-semibold">Graph matched: </span>
                                                                {(retrieval.graph_entities_matched || []).join(', ') || 'none'}
                                                            </div>
                                                            <div>
                                                                <span className="text-white/60 font-semibold">Graph saves: </span>
                                                                {retrieval.graph_save_ids?.length || 0} &nbsp;
                                                                <span className="text-white/60 font-semibold">Vector saves: </span>
                                                                {retrieval.vector_save_ids?.length || 0} &nbsp;
                                                                <span className="text-white/60 font-semibold">Merged: </span>
                                                                {retrieval.merged_ids?.length || 0}
                                                            </div>
                                                            <div>
                                                                <span className="text-white/60 font-semibold">Intent: </span>
                                                                {retrieval.intent || '—'} &nbsp;
                                                                <span className="text-white/60 font-semibold">AND mode: </span>
                                                                {retrieval.require_all ? 'yes' : 'no'}
                                                            </div>
                                                            <div>
                                                                <span className="text-white/60 font-semibold">Neo4j: </span>
                                                                {retrieval.neo4j_active ? '✅ active' : '⚠️ not configured'}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
