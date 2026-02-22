import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight, Trash2, Share2, Pencil, Check, X, ChevronRight, Sparkles, Loader2, Link as LinkIcon, ExternalLink, BookOpen } from 'lucide-react'
import { marked } from 'marked'
import { SOURCE_LABELS } from '../lib/constants'
import { supabase } from '../lib/supabase'

const EDGE_FN_URL = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
import { useToast } from './Toast'
import { Card, CardContent, CardFooter, CardHeader } from './ui/Card'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SOURCE_ICONS = {
    instagram: '📸',
    x: '𝕏',
    twitter: '𝕏',
    youtube: '▶',
    blog: '📄',
}

// Configure marked for clean rendering
marked.setOptions({
    breaks: true,
    gfm: true,
})

// Deep Research Modal
function ResearchModal({ dossier, title, onClose }) {
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    const htmlContent = marked.parse(dossier || '')

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center"
            style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="research-modal-title"
                className="relative mt-12 mb-12 w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-[#0e0e16] shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] shadow-lg">
                            <Sparkles className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-accent)]">Deep Research</p>
                            <p id="research-modal-title" className="text-sm font-semibold text-white/90 leading-tight line-clamp-1">{title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-red-500/80 hover:text-white transition-all"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div
                    className="research-prose flex-1 overflow-y-auto px-6 py-5 custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-white/30">Powered by gpt-4o-mini</span>
                    <button
                        onClick={onClose}
                        className="text-[12px] font-medium text-white/40 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function SaveCard({ save, onDelete, onUpdate }) {
    const { id, url, source, category, summary, tags, title, note, created_at, status, action_steps, error_msg } = save
    const [editing, setEditing] = useState(false)
    const [noteText, setNoteText] = useState(note || '')
    const [retrying, setRetrying] = useState(false)
    const [researching, setResearching] = useState(false)
    const [dossier, setDossier] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const inputRef = useRef(null)
    const toast = useToast()

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus()
    }, [editing])

    const saveNote = async () => {
        setEditing(false)
        if (noteText === (note || '')) return
        try {
            const res = await fetch(`${EDGE_FN_URL}/update-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
                body: JSON.stringify({ save_id: id, user_phone: save.user_phone, note: noteText }),
            })
            const data = await res.json()
            if (!data.error && onUpdate) {
                onUpdate({ ...save, note: noteText })
                toast.success('Note saved')
            } else if (data.error) {
                toast.error('Failed to save note')
            }
        } catch (e) {
            console.error(e)
            toast.error('Failed to save note')
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this save?')) return
        try {
            const res = await fetch(`${EDGE_FN_URL}/delete-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
                body: JSON.stringify({ save_id: id, user_phone: save.user_phone }),
            })
            const data = await res.json()
            if (!data.error) {
                if (onDelete) onDelete(id)
                toast.success('Deleted')
            } else {
                toast.error('Failed to delete')
            }
        } catch (e) {
            console.error(e)
            toast.error('Failed to delete')
        }
    }

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(url)
            toast.success('Link copied!')
        } catch {
            prompt('Copy this link:', url)
        }
    }

    const handleRetry = async () => {
        setRetrying(true)
        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/retry-classify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ id }),
            })
            const data = await res.json()
            if (data.success && onUpdate) {
                onUpdate({ ...save, ...data, status: 'complete', error_msg: null })
                toast.success('AI re-classification done')
            }
        } catch (e) {
            console.error(e)
            toast.error('Retry failed')
        }
        setRetrying(false)
    }

    const handleResearch = async () => {
        setResearching(true)
        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/deep-research`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ query: title || summary }),
            })
            const data = await res.json()
            if (data.dossier) {
                setDossier(data.dossier)
                setShowModal(true)
                toast.success('Research ready ✨')
            } else if (data.error) {
                toast.error(data.error.includes('Rate limit') ? 'Rate limit reached (5/hr). Try later.' : 'Research failed')
            } else {
                toast.error('Research failed')
            }
        } catch (e) {
            console.error(e)
            toast.error('Research failed')
        }
        setResearching(false)
    }

    const isPredicted = status === 'predicted' || (tags || []).includes('predicted')
    const hostname = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()

    return (
        <>
            <Card className="group h-full flex flex-col hover:border-[var(--color-accent)]/30 transition-all duration-300">
                {/* ── HEADER ── */}
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/5 text-lg shadow-inner">
                            {SOURCE_ICONS[source] || '🔗'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                                {SOURCE_LABELS[source] || source}
                            </span>
                            <span className="text-[11px] font-medium text-white/30">
                                {timeAgo(created_at)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={category === 'Other' ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wider">
                            {category}
                        </Badge>
                        <div className={cn(
                            "h-2 w-2 rounded-full shadow-[0_0_8px]",
                            status === 'error' ? "bg-red-500 shadow-red-500/50" : "bg-emerald-500 shadow-emerald-500/50"
                        )} />
                    </div>
                </CardHeader>

                {/* ── CONTENT ── */}
                <CardContent className="flex-1 space-y-4">
                    {/* Title / Summary */}
                    <div className="space-y-1">
                        <h3 className="line-clamp-3 text-[15px] font-medium leading-relaxed text-white/90 group-hover:text-white transition-colors">
                            {category === 'Other' && hostname.includes('instagram.com')
                                ? 'Instagram Reel/Post - Protected Content'
                                : (summary || title || 'Saved link')}
                        </h3>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)]/80 hover:text-[var(--color-accent)] hover:underline decoration-[var(--color-accent)]/30 underline-offset-2 transition-colors w-fit"
                        >
                            <LinkIcon className="h-3 w-3" />
                            {hostname}
                            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </a>
                    </div>

                    {/* Action Steps */}
                    {action_steps && action_steps.length > 0 && (
                        <div className="space-y-2 rounded-lg border-l-2 border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 py-2 pr-2 pl-3">
                            {action_steps.slice(0, 2).map((step, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]/60" />
                                    <span className="text-xs leading-relaxed text-white/60">{step}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI Predictions */}
                    {save.predictions && save.predictions.length > 0 && (
                        <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent)]/10 to-transparent p-3 shadow-inner">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">AI Suggestions</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x cursor-grab active:cursor-grabbing">
                                {save.predictions.map((pred, i) => (
                                    <a
                                        key={i}
                                        href={pred.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="snap-start shrink-0 w-48 rounded-lg border border-white/5 bg-[#0e0e1a]/80 p-2.5 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors group/pred block"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Badge variant="secondary" className="text-[9px] bg-white/5 text-white/50">{pred.category || 'Related'}</Badge>
                                            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover/pred:opacity-50 transition-opacity text-[var(--color-accent)]" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-white/80 line-clamp-2 mt-1 mb-1">{pred.title}</h4>
                                        <p className="text-[11px] text-white/40 line-clamp-2">{pred.summary}</p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Research ready indicator (replaces inline dossier) */}
                    {dossier && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full rounded-xl border border-[var(--color-accent)]/25 bg-gradient-to-r from-[var(--color-accent)]/10 to-[var(--color-accent-2)]/10 px-4 py-3 flex items-center gap-3 hover:from-[var(--color-accent)]/20 hover:to-[var(--color-accent-2)]/20 transition-all group/research cursor-pointer text-left"
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)]">
                                <BookOpen className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">Research Ready</p>
                                <p className="text-xs text-white/50 truncate">Click to read full dossier</p>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover/research:text-[var(--color-accent)] transition-colors shrink-0" />
                        </button>
                    )}

                    {/* Error */}
                    {status === 'error' && error_msg && (
                        <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                            <span className="flex items-center gap-2">⚠️ {error_msg}</span>
                            <button onClick={handleRetry} className="font-semibold underline decoration-red-300/30 hover:text-red-200">Retry</button>
                        </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {tags && tags.slice(0, 3).map((tag, i) => (
                            tag !== 'predicted' && (
                                <span key={i} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40 group-hover:border-white/10 group-hover:text-white/60 transition-colors">
                                    #{tag}
                                </span>
                            )
                        ))}
                    </div>
                </CardContent>

                {/* ── FOOTER ── */}
                <CardFooter className="border-t border-white/5 pt-4 mt-auto justify-between gap-3">
                    {/* Note */}
                    <div className="flex-1 min-w-0">
                        {editing ? (
                            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 pr-1.5 focus-within:border-[var(--color-accent)]/50 focus-within:ring-1 focus-within:ring-[var(--color-accent)]/50 transition-all">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveNote()
                                        if (e.key === 'Escape') { setEditing(false); setNoteText(note || '') }
                                    }}
                                    onBlur={saveNote}
                                    className="flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-white/20 outline-none"
                                    placeholder="Type a note..."
                                />
                                <button onClick={saveNote} className="rounded p-1 text-emerald-400 hover:bg-emerald-400/10">
                                    <Check className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : note ? (
                            <div
                                onClick={() => setEditing(true)}
                                className="group/note flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-0 pr-2 hover:bg-white/5 -ml-2 px-2 transition-colors"
                            >
                                <Pencil className="h-3 w-3 shrink-0 text-white/20 group-hover/note:text-[var(--color-accent)]" />
                                <span className="truncate text-xs italic text-white/50 group-hover/note:text-white/80 transition-colors">
                                    "{note}"
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditing(true)}
                                className="group/add flex items-center gap-2 py-1.5 text-xs font-medium text-white/30 hover:text-[var(--color-accent)] transition-colors"
                            >
                                <Pencil className="h-3 w-3 transition-transform group-hover/add:scale-110" />
                                <span>Add note</span>
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 hover:bg-[var(--color-accent)]/10 transition-all",
                                dossier ? "text-[var(--color-accent)]" : "text-white/40 hover:text-[var(--color-accent)]"
                            )}
                            onClick={dossier ? () => setShowModal(true) : handleResearch}
                            disabled={researching}
                            title={dossier ? "View Research" : "Deep Research"}
                        >
                            {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white" onClick={handleShare} title="Copy Link">
                            <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10" onClick={handleDelete} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardFooter>

                {/* Predicted Indicator */}
                {isPredicted && (
                    <div className="absolute top-3 right-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                    </div>
                )}
            </Card>

            {/* Research Modal — rendered outside card */}
            {dossier && showModal && (
                <ResearchModal
                    dossier={dossier}
                    title={title || summary || 'Research'}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    )
}
