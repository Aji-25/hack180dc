import { useState, useRef, useEffect } from 'react'
import { X, ArrowRight, Loader2, Sparkles, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { marked } from 'marked'

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

        // If no edge function URL is configured, do client-side search
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
        <div className="w-full">
            {/* Input */}
            <div style={{ position: 'relative' }}>
                {/* Glow behind */}
                <div style={{
                    position: 'absolute',
                    inset: '-2px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, rgba(124,109,250,0.4), rgba(244,114,182,0.3))',
                    filter: 'blur(12px)',
                    opacity: 0.6,
                    zIndex: 0,
                    pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(13,13,22,0.97)',
                    border: '1px solid rgba(124,109,250,0.3)',
                    borderRadius: '20px',
                    padding: '8px 8px 8px 20px',
                    gap: '12px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)',
                }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>
                        {loading ? '⏳' : '🧠'}
                    </span>
                    <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask your second brain anything..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: '16px',
                                color: 'var(--color-text)',
                                height: '52px',
                                fontFamily: 'inherit',
                                letterSpacing: '-0.01em',
                            }}
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => { setQuery(''); setAiReply(null); setReferences(null); }}
                                style={{
                                    padding: '4px',
                                    color: 'var(--color-text-tertiary)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <X style={{ width: '14px', height: '14px' }} />
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!query.trim() || loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, #7c6dfa, #a78bfa)',
                                color: '#fff',
                                fontSize: '15px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
                                opacity: !query.trim() || loading ? 0.5 : 1,
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 16px rgba(124,109,250,0.45)',
                                fontFamily: 'inherit',
                                letterSpacing: '-0.01em',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {loading ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <><span>Ask</span><ArrowRight style={{ width: '13px', height: '13px' }} /></>}
                        </button>
                    </form>
                </div>
            </div>

            {/* AI Reply */}
            <AnimatePresence>
                {aiReply && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{ marginTop: '12px' }}
                    >
                        <div style={{
                            background: 'rgba(13,13,22,0.95)',
                            border: '1px solid rgba(124,109,250,0.2)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(16px)',
                        }}>
                            {/* Top accent line */}
                            <div style={{
                                height: '2px',
                                background: 'linear-gradient(90deg, #7c6dfa, #f472b6)',
                            }} />
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, rgba(124,109,250,0.2), rgba(244,114,182,0.15))',
                                        border: '1px solid rgba(124,109,250,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Sparkles style={{ width: '14px', height: '14px', color: '#a78bfa' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}
                                            dangerouslySetInnerHTML={{ __html: marked(aiReply) }}
                                        />

                                        {references && references.length > 0 && (
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
                                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', fontWeight: 700, marginBottom: '8px' }}>
                                                    Sources
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                    {references.map((ref) => (
                                                        <a
                                                            key={ref.id}
                                                            href={ref.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                padding: '8px 10px',
                                                                borderRadius: '10px',
                                                                background: 'rgba(255,255,255,0.03)',
                                                                border: '1px solid var(--color-border-subtle)',
                                                                textDecoration: 'none',
                                                                transition: 'all 0.15s',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.borderColor = 'rgba(124,109,250,0.3)'
                                                                e.currentTarget.style.background = 'rgba(124,109,250,0.07)'
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                                                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                                {ref.title || ref.summary}
                                                            </span>
                                                            <ArrowUpRight style={{ width: '12px', height: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
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
