import { Filter, Instagram, StickyNote, Clock } from 'lucide-react'
import { Badge } from './ui/Badge'
import { cn } from '../lib/utils'

const FILTERS = [
    { key: 'instagram', label: 'Instagram only', icon: Instagram },
    { key: 'withNotes', label: 'With notes', icon: StickyNote },
    { key: 'recent', label: 'Last 7 days', icon: Clock },
]

export default function QuickFilters({ active, onToggle }) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                <Filter className="h-3.5 w-3.5 text-white/40" />
            </div>
            {FILTERS.map(({ key, label, icon: Icon }) => {
                const isActive = active.includes(key)
                return (
                    <button
                        key={key}
                        onClick={() => onToggle(key)}
                        className={cn(
                            "group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all",
                            isActive
                                ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                : "border-white/5 bg-white/5 text-[#9090b8] hover:border-white/10 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <Icon className={cn("h-3.5 w-3.5 transition-colors", isActive ? "text-[var(--color-accent)]" : "text-[#5a5a80] group-hover:text-white/70")} />
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
