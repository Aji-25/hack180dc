import { ArrowUpRight } from 'lucide-react'

export default function EmptyState({ search, category }) {
    const hasFilters = search || (category && category !== 'All')

    return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
            {hasFilters ? (
                <>
                    <p className="text-[15px] font-medium text-text mb-1">No matches</p>
                    <p className="text-[13px] text-text-tertiary text-center max-w-xs">
                        Try a different search term or clear the category filter.
                    </p>
                </>
            ) : (
                <>
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
                        <span className="text-xl">📩</span>
                    </div>
                    <p className="text-[15px] font-medium text-text mb-1">No saves yet</p>
                    <p className="text-[13px] text-text-tertiary text-center max-w-xs mb-4">
                        Forward an Instagram link to the WhatsApp bot and it shows up here instantly.
                    </p>
                    <a
                        href="https://wa.me/14155238886"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost text-[12px]"
                    >
                        Open WhatsApp <ArrowUpRight className="w-3 h-3" />
                    </a>
                </>
            )}
        </div>
    )
}
