import { useState } from 'react'
import { Shuffle, X, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function RandomInspiration({ userPhone }) {
    const [item, setItem] = useState(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    const fetchRandom = async () => {
        setLoading(true)
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
                if (data?.[0]) { setItem(data[0]); setOpen(true) }
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    return (
        <>
            <button onClick={fetchRandom} disabled={loading} className="btn btn-accent">
                <Shuffle className="w-3.5 h-3.5" />
                {loading ? 'Picking...' : 'Surprise me'}
            </button>

            {open && item && (
                <div className="overlay" onClick={() => setOpen(false)}>
                    <div className="modal p-6 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[13px] font-semibold text-text-secondary">Random pick</span>
                            <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-secondary">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Category */}
                        <span className={`cat-badge cat-${item.category} mb-3 inline-flex`}>{item.category}</span>

                        {/* Summary */}
                        <p className="text-[14px] text-text leading-relaxed mb-3">{item.summary || 'Saved link'}</p>

                        {/* Tags */}
                        {item.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                                {item.tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
                            </div>
                        )}

                        {item.note && <div className="note-block mb-4">"{item.note}"</div>}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-accent flex-1 justify-center"
                            >
                                Open <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                            <button onClick={fetchRandom} className="btn btn-ghost">
                                <Shuffle className="w-3.5 h-3.5" />
                                Another
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
