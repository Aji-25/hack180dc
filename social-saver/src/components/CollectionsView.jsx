import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { CATEGORY_EMOJIS } from '../lib/constants'
import SaveCard from './SaveCard'

export default function CollectionsView({ saves, onDelete, onUpdate }) {
    const [collapsed, setCollapsed] = useState({})

    // Group by category
    const groups = {}
    saves.forEach(save => {
        const cat = save.category || 'Other'
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(save)
    })

    // Sort: categories with most saves first
    const sortedKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length)

    const toggleCollapse = (cat) => {
        setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
    }

    if (saves.length === 0) return null

    return (
        <div className="space-y-4">
            {sortedKeys.map(cat => {
                const isCollapsed = collapsed[cat]
                const items = groups[cat]
                const emoji = CATEGORY_EMOJIS[cat] || '📌'

                return (
                    <div key={cat} className="collection-section">
                        <button
                            onClick={() => toggleCollapse(cat)}
                            className="collection-header w-full"
                        >
                            <div className="flex items-center gap-2 flex-1">
                                {isCollapsed
                                    ? <ChevronRight className="w-4 h-4 text-text-tertiary" />
                                    : <ChevronDown className="w-4 h-4 text-text-tertiary" />
                                }
                                <span className="text-[14px] font-semibold">{emoji} {cat}</span>
                                <span className="collection-count">{items.length}</span>
                            </div>
                        </button>

                        {!isCollapsed && (
                            <div className="saves-grid mt-2">
                                {items.map(save => (
                                    <SaveCard key={save.id} save={save} onDelete={onDelete} onUpdate={onUpdate} />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
