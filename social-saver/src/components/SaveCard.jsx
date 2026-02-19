import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight, Trash2, Share2, Pencil, Check, X, ChevronRight, Sparkles, Loader2 } from 'lucide-react'
import { SOURCE_LABELS } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'

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

export default function SaveCard({ save, onDelete, onUpdate }) {
    const { id, url, source, category, summary, tags, title, note, created_at, status, action_steps, error_msg } = save
    const [editing, setEditing] = useState(false)
    const [noteText, setNoteText] = useState(note || '')
    const [retrying, setRetrying] = useState(false)
    const [researching, setResearching] = useState(false)
    const [dossier, setDossier] = useState(null)
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
        if (!confirm('Are you sure you want to delete this save?')) return
        try {
            await supabase.from('saves').delete().eq('id', id)
            if (onDelete) onDelete(id)
            toast.success('Deleted')
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: title || summary }),
            })
            const data = await res.json()
            if (data.dossier) {
                setDossier(data.dossier)
                toast.success('Dossier Generated ✨')
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
            const newTags = (tags || []).filter(t => t !== 'predicted')
            const { error } = await supabase.from('saves').update({ status: 'complete', tags: newTags }).eq('id', id)
            if (!error && onUpdate) {
                onUpdate({ ...save, status: 'complete', tags: newTags })
                toast.success('Added to saves')
            }
        } catch (e) {
            toast.error('Error accepting')
        }
    }

    const isPredicted = status === 'predicted' || (tags || []).includes('predicted')
    const hostname = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()

    /* ─── Render ─── */
    return (
        <div className="card group" style={{ display: 'flex', flexDirection: 'column', minHeight: '280px', height: '100%' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', flexShrink: 0,
                    }}>
                        {SOURCE_ICONS[source] || '🔗'}
                    </span>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7c6dfa' }}>
                            {SOURCE_LABELS[source] || source}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontWeight: 500 }}>
                            {timeAgo(created_at)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                        padding: '6px 14px', borderRadius: '100px',
                        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        {category}
                    </span>
                    <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: status === 'error' ? '#ef4444' : '#22c55e',
                        boxShadow: status === 'error' ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 10px rgba(34,197,94,0.5)',
                    }} />
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Title / Summary */}
                <h3 style={{
                    fontSize: '17px', fontWeight: 500, lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.92)', margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {summary || title || 'Saved link'}
                </h3>

                {/* Hostname */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(124,109,250,0.5)' }} />
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                        {hostname}
                    </span>
                </div>

                {/* Action Steps */}
                {action_steps && action_steps.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '6px', borderLeft: '2px solid rgba(124,109,250,0.15)', marginTop: '4px' }}>
                        {action_steps.slice(0, 2).map((step, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '14px' }}>
                                <ChevronRight style={{ width: '14px', height: '14px', marginTop: '2px', color: 'rgba(124,109,250,0.6)', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{step}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dossier */}
                {dossier && (
                    <div style={{
                        padding: '16px', borderRadius: '16px',
                        background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.12)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#a78bfa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <Sparkles style={{ width: '12px', height: '12px' }} /> Deep Dive
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {dossier}
                        </p>
                    </div>
                )}

                {/* Error */}
                {status === 'error' && error_msg && (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: '12px' }}>
                        ⚠️ {error_msg}
                        <button onClick={handleRetry} style={{ marginLeft: '10px', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontWeight: 600 }}>Retry</button>
                    </div>
                )}

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                    {tags && tags.slice(0, 3).map((tag, i) => (
                        tag !== 'predicted' && (
                            <span key={i} style={{
                                fontSize: '11px', fontWeight: 500,
                                padding: '5px 14px', borderRadius: '100px',
                                background: 'rgba(167,139,250,0.08)', color: 'rgba(167,139,250,0.7)',
                                border: '1px solid rgba(167,139,250,0.12)',
                            }}>
                                #{tag}
                            </span>
                        )
                    ))}
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
                marginTop: '28px', paddingTop: '20px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            }}>
                {/* Note */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                                style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '12px', color: '#fff', outline: 'none', height: '28px', fontFamily: 'inherit' }}
                                placeholder="Type a note..."
                            />
                            <button onClick={saveNote} style={{ padding: '4px', borderRadius: '6px', background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' }}>
                                <Check style={{ width: '14px', height: '14px' }} />
                            </button>
                        </div>
                    ) : note ? (
                        <div
                            onClick={() => setEditing(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 10px', borderRadius: '10px', marginLeft: '-10px' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Pencil style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                "{note}"
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={() => setEditing(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#7c6dfa'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >
                            <Pencil style={{ width: '13px', height: '13px' }} /> Add note
                        </button>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[
                        { icon: Sparkles, onClick: handleResearch, title: 'Research', hoverBg: 'rgba(124,109,250,0.12)', hoverColor: '#7c6dfa', loading: researching },
                        { icon: Share2, onClick: handleShare, title: 'Copy Link', hoverBg: 'rgba(255,255,255,0.06)', hoverColor: '#fff' },
                        { icon: ArrowUpRight, onClick: () => window.open(url, '_blank'), title: 'Open', hoverBg: 'rgba(255,255,255,0.06)', hoverColor: '#fff' },
                        { icon: Trash2, onClick: handleDelete, title: 'Delete', hoverBg: 'rgba(239,68,68,0.1)', hoverColor: '#f87171' },
                    ].map(({ icon: Icon, onClick, title: t, hoverBg, hoverColor, loading: ld }, i) => (
                        <button
                            key={i}
                            onClick={onClick}
                            title={t}
                            disabled={ld}
                            style={{
                                padding: '8px', borderRadius: '10px', background: 'none', border: 'none',
                                color: 'rgba(255,255,255,0.18)', cursor: 'pointer',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor; e.currentTarget.style.transform = 'scale(1.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'scale(1)' }}
                        >
                            {ld ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Icon style={{ width: '16px', height: '16px' }} />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Predicted indicator */}
            {isPredicted && (
                <div style={{ position: 'absolute', top: '-4px', right: '-4px' }}>
                    <span style={{ position: 'relative', display: 'flex', width: '12px', height: '12px' }}>
                        <span style={{ position: 'absolute', display: 'inline-flex', width: '100%', height: '100%', borderRadius: '50%', background: '#22c55e', opacity: 0.7, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
                        <span style={{ position: 'relative', display: 'inline-flex', width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
                    </span>
                </div>
            )}
        </div>
    )
}
