import { ArrowUpRight, Inbox } from 'lucide-react'
import { Button } from './ui/Button'

export default function EmptyState({ search, category }) {
    const hasFilters = search || (category && category !== 'All')

    return (
        <div className="flex flex-col items-center justify-center py-32 px-4">
            {hasFilters ? (
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Inbox className="w-8 h-8 text-white/20" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No matches found</h3>
                    <p className="text-sm text-white/40 max-w-xs mx-auto">
                        Try adjusting your search or clearing the category filter.
                    </p>
                </div>
            ) : (
                <div className="text-center">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent-2)]/10 border border-white/5 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(124,109,250,0.1)]">
                        <span className="text-4xl filter drop-shadow-lg">📩</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">No saves yet</h3>
                    <p className="text-white/50 text-base max-w-sm mx-auto mb-8 leading-relaxed">
                        Your library is empty. Message our WhatsApp bot to start saving:
                        <br />
                        <span className="font-mono text-[var(--color-accent)] mt-2 block">
                            +1 415 523 8886
                        </span>
                    </p>
                    <a
                        href="https://wa.me/14155238886?text=join%20step-camp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                    >
                        <Button className="shadow-lg shadow-[var(--color-accent)]/20">
                            Click here to message our bot <ArrowUpRight className="w-4 h-4 ml-2" />
                        </Button>
                    </a>
                </div>
            )}
        </div>
    )
}
