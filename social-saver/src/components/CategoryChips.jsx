import { CATEGORIES } from '../lib/constants'

export default function CategoryChips({ selected, onSelect, counts }) {
    return (
        <div className="chip-scroll flex flex-nowrap sm:flex-wrap gap-1.5">
            {CATEGORIES.map(cat => {
                const isActive = selected === cat
                const count = cat === 'All'
                    ? Object.values(counts || {}).reduce((a, b) => a + b, 0)
                    : (counts || {})[cat] || 0

                return (
                    <button
                        key={cat}
                        onClick={() => onSelect(cat)}
                        className={`chip ${isActive ? 'chip-active' : 'chip-inactive'}`}
                    >
                        <span>{cat}</span>
                        {count > 0 && (
                            <span className={`text-[11px] ${isActive ? 'opacity-60' : 'opacity-40'}`}>
                                {count}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
