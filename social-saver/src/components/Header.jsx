import { Bookmark, TrendingUp, Calendar, Zap, Sparkles } from 'lucide-react'
import SyncModal from './SyncModal'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'

export default function Header({ totalSaves, stats, userPhone, onLogoClick }) {
    const topCategory = stats?.categories
        ? Object.entries(stats.categories).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null

    const weekCount = stats?.weekCount ?? totalSaves

    return (
        <header className="fixed top-0 z-40 w-full border-b border-white/5 bg-[var(--color-bg)]/80 backdrop-blur-xl transition-all duration-300">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                {/* Left Section */}
                <div className="flex items-center gap-6">
                    {/* Logo */}
                    <button
                        onClick={onLogoClick}
                        className="group flex items-center gap-3 transition-opacity hover:opacity-80"
                        title="Back to landing page"
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] shadow-lg shadow-[var(--color-accent)]/20 ring-1 ring-white/20 transition-transform group-hover:scale-105">
                            <Bookmark className="h-5 w-5 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="bg-gradient-to-br from-white to-white/70 bg-clip-text text-lg font-bold tracking-tight text-transparent">
                            Social Saver
                        </span>
                    </button>

                    {/* Divider */}
                    <div className="h-6 w-px bg-white/10" />

                    {/* Stats */}
                    {totalSaves > 0 && (
                        <div className="hidden items-center gap-3 md:flex">
                            <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50">
                                <Calendar className="h-3.5 w-3.5 opacity-50" />
                                <span className="font-mono text-white/80">{weekCount}</span>
                                <span>this week</span>
                            </div>

                            {topCategory && (
                                <Badge variant={topCategory.toLowerCase()} className="h-auto py-1.5 pl-2 pr-3 text-xs font-medium capitalize">
                                    <TrendingUp className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                                    {topCategory}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-4">
                    {userPhone && <SyncModal userPhone={userPhone} />}

                    {totalSaves > 0 && (
                        <div className="flex items-center gap-2 rounded-full border border-[var(--color-accent)]/10 bg-[var(--color-accent)]/5 px-4 py-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                            <span className="font-mono text-sm font-bold text-white/90">
                                {totalSaves}
                            </span>
                            <span className="text-xs font-medium text-white/40">
                                saves
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
