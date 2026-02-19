import { useState, useRef } from 'react'
import { X, ArrowRight, Loader2, Sparkles, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { marked } from 'marked'
import { Button } from './ui/Button'

export default function AskSaves({ saves }) {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiReply, setAiReply] = useState(null)
    const [references, setReferences] = useState(null)
    const inputRef = useRef(null)

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        setAiReply(null)
        setReferences(null)

        const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''

        // Client-side search fallback
        if (!edgeFnUrl) {
            const q = query.toLowerCase()
            const matches = saves.filter(s => {
                const text = [
                    s.title, s.summary, s.category, s.note,
                    ...(s.tags || []),
                    ...(s.action_steps || []),
                ].filter(Boolean).join(' ').toLowerCase()
                return text.includes(q) || q.split(/\s+/).some(w => w.length > 2 && text.includes(w))
            })

            if (matches.length > 0) {
                const lines = matches.map(m => {
                    const title = m.title || 'Untitled'
                    const summary = m.summary || ''
                    const tags = (m.tags || []).map(t => `\`#${t}\``).join(' ')
                    return `**${title}** — ${summary}${tags ? `\n${tags}` : ''}`
                })
                setAiReply(`Found **${matches.length}** matching save${matches.length > 1 ? 's' : ''}:\n\n${lines.join('\n\n')}`)
                setReferences(matches.map(m => ({ id: m.id, url: m.url, title: m.title || m.summary })))
            } else {
                setAiReply(`No saves matching **"${query}"**. Try searching for a category like "fitness" or a tag like "recipe".`)
            }
            setLoading(false)
            return
        }

        try {
            const res = await fetch(`${edgeFnUrl}/chat-brain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ query }),
            })
            const data = await res.json()

            if (data.reply) {
                setAiReply(data.reply)
                setReferences(data.references || [])
            } else {
                setAiReply('Sorry, I could not generate an answer.')
            }
        } catch (err) {
            console.error(err)
            setAiReply('Error connecting to brain.')
        }
        setLoading(false)
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            {/* Hero Input */}
            <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] opacity-20 blur transition duration-500 group-hover:opacity-40" />
                <div className="relative flex items-center gap-4 rounded-xl border border-white/10 bg-[#161616]/80 p-2 pl-6 shadow-2xl backdrop-blur-xl transition-all focus-within:border-[var(--color-accent)]/50 focus-within:bg-[#1c1c1c]">
                    <Sparkles className={`h-6 w-6 text-[var(--color-accent)] ${loading ? 'animate-pulse' : ''}`} />

                    <form onSubmit={handleSearch} className="flex flex-1 items-center gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask your second brain anything..."
                            className="flex-1 bg-transparent py-4 text-lg font-medium text-white placeholder-white/20 outline-none"
                        />

                        {query && (
                            <button
                                type="button"
                                onClick={() => { setQuery(''); setAiReply(null); setReferences(null); }}
                                className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}

                        <Button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className={`rounded-lg px-6 py-2.5 font-bold transition-all ${!query.trim() ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
            </div>

            {/* AI Reply */}
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
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                                        <Sparkles className="h-5 w-5 text-[var(--color-accent-2)]" />
                                    </div>
                                    <div className="flex-1 space-y-6">
                                        <div
                                            className="prose prose-invert max-w-none text-base leading-relaxed text-[#9090b8] prose-strong:text-white prose-p:my-2"
                                            dangerouslySetInnerHTML={{ __html: marked(aiReply) }}
                                        />

                                        {references && references.length > 0 && (
                                            <div className="border-t border-white/5 pt-6">
                                                <div className="mb-4 text-xs font-bold uppercase tracking-wider text-[#5a5a80]">
                                                    Sources
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {references.map((ref) => (
                                                        <a
                                                            key={ref.id}
                                                            href={ref.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3 transition-all hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10"
                                                        >
                                                            <span className="truncate text-sm font-medium text-[#9090b8] group-hover:text-[#f0f0ff]">
                                                                {ref.title || ref.summary}
                                                            </span>
                                                            <ArrowUpRight className="h-3.5 w-3.5 text-[#5a5a80] transition-colors group-hover:text-[#a78bfa]" />
                                                        </a>
                                                    ))}
                                                </div>
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
