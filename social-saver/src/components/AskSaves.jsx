import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Search, X, ArrowRight, Loader2, Sparkles, Brain, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { marked } from 'marked'

export default function AskSaves({ saves }) { // saves prop is ignored now, as we use RAG
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

        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/chat-brain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/50 to-purple-500/50 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative bg-bg-card border border-border/50 rounded-xl p-1 flex items-center shadow-2xl">
                    <div className="pl-3 pr-2 text-accent">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    </div>
                    <form onSubmit={handleSearch} className="flex-1 flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask your second brain..."
                            className="w-full bg-transparent border-none outline-none text-[15px] placeholder:text-text-tertiary h-10 px-2 text-text"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="p-1.5 text-text-tertiary hover:text-text-secondary rounded-full hover:bg-bg-elevated transition-colors mr-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className="bg-accent text-bg-base rounded-lg px-3 py-1.5 text-[13px] font-medium flex items-center gap-1.5 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <span>Ask</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>

            <AnimatePresence>
                {aiReply && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-5 bg-gradient-to-b from-bg-elevated to-bg-card rounded-xl border border-border/60 shadow-lg relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-purple-500 alpha-50"></div>

                        {/* Answer */}
                        <div className="flex gap-3">
                            <div className="mt-1 min-w-[24px]">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="space-y-4 w-full">
                                <div className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text prose-strong:text-text prose-a:text-accent max-w-none text-[14px] leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: marked(aiReply) }}
                                />

                                {/* References RAG */}
                                {references && references.length > 0 && (
                                    <div className="pt-4 mt-4 border-t border-border-subtle/50">
                                        <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold mb-2">
                                            Sources
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {references.map((ref) => (
                                                <a
                                                    key={ref.id}
                                                    href={ref.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-2 rounded bg-bg-base/50 hover:bg-bg-elevated border border-transparent hover:border-border-subtle transition-all group/ref text-left"
                                                >
                                                    <span className="text-[12px] text-text-secondary truncate flex-1 group-hover/ref:text-accent transition-colors">
                                                        {ref.title || ref.summary}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-text-tertiary bg-bg-raised px-1.5 py-0.5 rounded">
                                                            {Math.round(ref.similarity * 100)}%
                                                        </span>
                                                        <ArrowUpRight className="w-3 h-3 text-text-tertiary opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
