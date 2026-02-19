import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { CATEGORY_EMOJIS } from '../lib/constants'
import SaveCard from './SaveCard'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

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
        <div className="space-y-6">
            {sortedKeys.map((cat, i) => {
                const isCollapsed = collapsed[cat]
                const items = groups[cat]
                const emoji = CATEGORY_EMOJIS[cat] || '📌'

                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={cat}
                        className="rounded-2xl border border-white/5 bg-[var(--color-bg-raised)]/20 overflow-hidden"
                    >
                        <button
                            onClick={() => toggleCollapse(cat)}
                            className={cn(
                                "w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors",
                                !isCollapsed && "border-b border-white/5"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-colors",
                                    isCollapsed ? "bg-white/5 text-white/40" : "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                )}>
                                    {isCollapsed
                                        ? <ChevronRight className="w-4 h-4" />
                                        : <ChevronDown className="w-4 h-4" />
                                    }
                                </div>
                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                    <span className="text-lg">{emoji}</span>
                                    {cat}
                                </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-xs font-medium text-white/40 border border-white/5">
                                {items.length}
                            </span>
                        </button>

                        <AnimatePresence>
                            {!isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                                        {items.map(save => (
                                            <SaveCard key={save.id} save={save} onDelete={onDelete} onUpdate={onUpdate} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )
            })}
        </div>
    )
}
