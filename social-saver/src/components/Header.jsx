import { Bookmark, TrendingUp, Tag, Calendar } from 'lucide-react'
import SyncModal from './SyncModal'

export default function Header({ totalSaves, stats, userPhone }) {
    const topCategory = stats?.categories
        ? Object.entries(stats.categories).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null

    // Count saves this week
    const weekCount = stats?.weekCount ?? totalSaves

    return (
        <header className="flex items-center justify-between">
            <div className="flex items-center gap-5">
                {/* Logo + Sync */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ff8c42' }}>
                            <Bookmark className="w-4 h-4 text-black" strokeWidth={2.5} />
                        </div>
                        <span className="text-[15px] font-semibold tracking-tight hidden sm:inline">Social Saver</span>
                    </div>
                    {userPhone && <SyncModal userPhone={userPhone} />}
                </div>

                {/* Stats pills */}
                {totalSaves > 0 && (
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-text-tertiary">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="font-mono">{weekCount}</span>
                            <span>this week</span>
                        </div>
                        {topCategory && (
                            <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>Top: {topCategory}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right: count */}
            <span className="text-[13px] text-text-tertiary tabular-nums font-mono">
                {totalSaves} save{totalSaves !== 1 ? 's' : ''}
            </span>
        </header>
    )
}
