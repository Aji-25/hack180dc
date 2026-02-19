import { CATEGORIES } from '../lib/constants'
import { cn } from '../lib/utils'

export default function CategoryChips({ selected, onSelect, counts }) {
    return (
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-none sm:flex-wrap sm:pb-0">
            {CATEGORIES.map(cat => {
                const isActive = selected === cat
                const count = cat === 'All'
                    ? Object.values(counts || {}).reduce((a, b) => a + b, 0)
                    : (counts || {})[cat] || 0

                return (
                    <button
                        key={cat}
                        onClick={() => onSelect(cat)}
                        className={cn(
                            "group inline-flex h-7 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                            isActive
                                ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-white shadow-[0_0_12px_rgba(124,109,250,0.15)]"
                                : "border-white/5 bg-white/5 text-[#9090b8] hover:border-white/10 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <span>{cat}</span>
                        {count > 0 && (
                            <span className={cn(
                                "flex h-4 min-w-[16px] items-center justify-center rounded-[4px] px-1 text-[10px] font-bold",
                                isActive
                                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                                    : "bg-white/5 text-[#5a5a80] group-hover:bg-white/10 group-hover:text-[#9090b8]"
                            )}>
                                {count}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
