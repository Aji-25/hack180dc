import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight, Trash2, Share2, RotateCw, Pencil, Check, X, ChevronRight, BookOpen, Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { marked } from 'marked'
import { SOURCE_LABELS } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SaveCard({ save, onDelete, onUpdate }) {
    const { id, url, source, category, summary, tags, title, note, created_at, status, action_steps, error_msg } = save
    const [editing, setEditing] = useState(false)
    const [noteText, setNoteText] = useState(note || '')
    const [retrying, setRetrying] = useState(false)
    const [researching, setResearching] = useState(false)
    const [dossier, setDossier] = useState(null)
    const [showActions, setShowActions] = useState(false)
    const inputRef = useRef(null)
    const toast = useToast()

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus()
    }, [editing])

    const saveNote = async () => {
        setEditing(false)
        if (noteText === (note || '')) return
        try {
            const { error } = await supabase.from('saves').update({ note: noteText }).eq('id', id)
            if (!error && onUpdate) {
                onUpdate({ ...save, note: noteText })
                toast.success('Note saved')
            }
        } catch (e) {
            console.error(e)
            toast.error('Failed to save note')
        }
    }

    const handleDelete = async () => {
        try {
            await supabase.from('saves').delete().eq('id', id)
            if (onDelete) onDelete(id)
            toast.success('Save deleted')
        } catch (e) {
            console.error(e)
            toast.error('Failed to delete')
        }
    }

    const handleShare = async () => {
        const shareUrl = url
        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success('Link copied to clipboard')
        } catch {
            prompt('Copy this link:', shareUrl)
        }
    }

    const handleRetry = async () => {
        setRetrying(true)
        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/retry-classify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await res.json()
            if (data.success && onUpdate) {
                onUpdate({ ...save, ...data, status: 'complete', error_msg: null })
                toast.success('AI re-classification complete')
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: title || summary }),
            })
            const data = await res.json()
            if (data.dossier) {
                setDossier(data.dossier)
                toast.success('Research Dossier Generated')
            } else {
                toast.error('Research failed')
            }
        } catch (e) {
            console.error(e)
            toast.error('Research failed')
        }
        setResearching(false)
    }

    const handleAcceptPrediction = async () => {
        try {
            // Remove 'predicted' tag and set status to complete
            const newTags = (tags || []).filter(t => t !== 'predicted')
            const { error } = await supabase.from('saves').update({ status: 'complete', tags: newTags }).eq('id', id)
            if (!error && onUpdate) {
                onUpdate({ ...save, status: 'complete', tags: newTags })
                toast.success('Suggestion added to saves')
            }
        } catch (e) {
            toast.error('Error accepting')
        }
    }

    return (
        <div
            className="p-4 flex flex-col gap-2 min-h-[140px] group relative"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {/* Top: source + time + status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`source-label source-${source}`}>
                        {SOURCE_LABELS[source] || source}
                    </span>
                    <span className={`dot ${status === 'pending_note' ? 'dot-pending' : status === 'error' ? 'dot-err' : 'dot-ok'}`} />
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Hover actions (always visible on mobile via CSS) */}
                    <div className={`card-actions flex items-center gap-0.5 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={handleShare} className="p-1.5 rounded text-text-tertiary hover:text-text-secondary transition-colors" title="Copy link">
                            <Share2 className="w-3 h-3" />
                        </button>
                        {status === 'error' && (
                            <button onClick={handleRetry} disabled={retrying} className="p-1.5 rounded text-text-tertiary hover:text-accent transition-colors" title="Retry AI">
                                <RotateCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                        <button onClick={handleDelete} className="p-1.5 rounded text-text-tertiary hover:text-red transition-colors" title="Delete">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                    <span className="text-[11px] text-text-tertiary font-mono tabular-nums">
                        {timeAgo(created_at)}
                    </span>
                </div>
            </div>

            {/* Category badge */}
            <div>
                <span className={`cat-badge cat-${category}`}>{category}</span>
            </div>

            {/* Summary */}
            <p className="text-[13px] text-text-secondary leading-[1.55]">
                {summary || 'Saved link'}
            </p>

            {/* Action steps (if present) */}
            {action_steps && action_steps.length > 0 && (
                <div className="flex flex-col gap-1 pl-1">
                    {action_steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-text-tertiary">
                            <ChevronRight className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: '#ff8c42' }} />
                            <span>{step}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Error message */}
            {status === 'error' && error_msg && (
                <div className="text-[11px] text-red bg-red-muted rounded px-2 py-1">
                    Error: {error_msg.slice(0, 80)}
                    {!retrying && (
                        <button onClick={handleRetry} className="ml-2 underline hover:no-underline">
                            Retry
                        </button>
                    )}
                </div>
            )}

            {/* User note (editable) */}
            {editing ? (
                <div className="flex gap-1.5 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') { setEditing(false); setNoteText(note || '') } }}
                        onBlur={saveNote}
                        className="flex-1 bg-bg-elevated border border-border rounded px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                        placeholder="Add a note..."
                    />
                    <button onClick={saveNote} className="text-green"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditing(false); setNoteText(note || '') }} className="text-text-tertiary"><X className="w-3.5 h-3.5" /></button>
                </div>
            ) : note ? (
                <div className="note-block cursor-pointer group/note" onClick={() => setEditing(true)}>
                    <div className="flex items-center justify-between">
                        <span>"{note}"</span>
                        <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/note:opacity-100 text-text-tertiary transition-opacity" />
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setEditing(true)}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors text-left"
                >
                    + Add a note
                </button>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag, i) => (
                        <span key={i} className="tag">{tag}</span>
                    ))}
                </div>
            )}

            {/* Open link — bottom */}
            <div className="pt-1 mt-auto">
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link group/link"
                >
                    <span className="truncate max-w-[200px] inline-block align-bottom">
                        {title || (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()}
                    </span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                </a>
            </div>
        </div>
    )
}
