import { Filter, Instagram, StickyNote, Clock } from 'lucide-react'

const FILTERS = [
    { key: 'instagram', label: 'Instagram only', icon: Instagram },
    { key: 'withNotes', label: 'With notes', icon: StickyNote },
    { key: 'recent', label: 'Last 7 days', icon: Clock },
]

export default function QuickFilters({ active, onToggle }) {
    return (
        <div className="quick-filters-scroll">
            <Filter className="w-3.5 h-3.5 text-text-tertiary mr-0.5 shrink-0" />
            {FILTERS.map(({ key, label, icon: Icon }) => {
                const isActive = active.includes(key)
                return (
                    <button
                        key={key}
                        onClick={() => onToggle(key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all border whitespace-nowrap shrink-0 ${isActive
                                ? 'bg-accent-muted border-accent-border text-text'
                                : 'bg-transparent border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border'
                            }`}
                    >
                        <Icon className="w-3 h-3" />
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
