import { useState, useEffect } from 'react'
import { RefreshCw, Database, Bell, Check, X, Loader2, ArrowRight, Sparkles, Settings } from 'lucide-react'
import { useToast } from './Toast'

export default function SyncModal({ userPhone }) {
    const [open, setOpen] = useState(false)
    const [notionKey, setNotionKey] = useState('')
    const [dbId, setDbId] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [reminding, setReminding] = useState(false)
    const [predictiveMode, setPredictiveMode] = useState(false)
    const toast = useToast()

    useEffect(() => {
        if (open) {
            setNotionKey(localStorage.getItem('notion_key') || '')
            setDbId(localStorage.getItem('notion_db_id') || '')
            setPredictiveMode(localStorage.getItem('predictive_mode') === 'true')
        }
    }, [open])

    const handleSync = async () => {
        if (!notionKey || !dbId) {
            toast.error('Please enter Notion credentials')
            return
        }
        localStorage.setItem('notion_key', notionKey)
        localStorage.setItem('notion_db_id', dbId)
        setSyncing(true)

        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            // In a real app complexity, we'd fetch saves here or pass them in. 
            // For demo, we'll fetch from Supabase in the edge function or pass a few mock ones if needed.
            // Simplified: The backend function handles fetching if we passed userPhone, but our current backend expects 'saves' array.
            // Let's adjust to just pass userPhone to the backend and let IT fetch. 
            // WAIT: The backend I wrote expects { saves, ... }. I should update the backend or fetch here.
            // Fetching here is safer for the demo to ensure we have data.

            // Re-use the sync logic from App (prop drilling saves is annoying). 
            // Let's just fetch recent 5 saves here to sync.
            // Actually, better to update the Edge Function to fetch by userPhone.
            // But I already wrote the Edge Function to take `saves`. 
            // I'll just pass a dummy "Simulated Save" if I can't easily access saves here.
            // OR better: I'll trigger the "Export" from App.jsx and pass it down? No, too much refactor.
            // slightly hacky: I'll fetch 5 latest saves for this user via Supabase client here.

            // ... Actually, for the hackathon demo, I'll allow the user to see it working.
            // I'll fetch the saves in this component.

            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
            const { data: saves } = await supabase.from('saves').select('*').eq('user_phone', userPhone).limit(10)

            if (!saves || saves.length === 0) {
                toast.error('No saves to sync.')
                setSyncing(false)
                return
            }

            const res = await fetch(`${edgeFnUrl}/notion-export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saves, notionKey, databaseId: dbId }),
            })
            const data = await res.json()

            if (data.success) {
                toast.success(`Synced ${data.synced} saves to Notion!`)
                setOpen(false)
            } else {
                toast.error('Sync failed: ' + (data.error || 'Unknown'))
            }
        } catch (e) {
            console.error(e)
            toast.error('Sync failed')
        }
        setSyncing(false)
    }

    const handleRemind = async () => {
        setReminding(true)
        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/send-reminders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPhone }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`Reminder sent: ${data.reminded}`)
            } else {
                toast.error('Failed: ' + (data.message || data.error))
            }
        } catch (e) {
            console.error(e)
            toast.error('Reminder failed')
        }
        setReminding(false)
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-tertiary hover:text-white hover:bg-white/5 transition-all text-[13px]"
                title="Sync & Tools"
            >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setOpen(false)}
                    />

                    <div
                        className="relative w-full max-w-md bg-[#0F1115]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-accent-primary/5 overflow-hidden transform transition-all scale-100 opacity-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Decorative background gradients */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-secondary/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5 relative z-10">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-accent-primary" />
                                <span className="text-[14px] font-semibold text-white">Sync & Tools</span>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-text-tertiary hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 relative z-10 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {/* Notion Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                        <Database className="w-3.5 h-3.5 text-text-secondary" />
                                    </div>
                                    Notion Sync
                                </div>
                                <div className="space-y-3 pl-8">
                                    <input
                                        type="password"
                                        value={notionKey}
                                        onChange={e => setNotionKey(e.target.value)}
                                        placeholder="Integration Token (secret_...)"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-text-tertiary focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/50 transition-all outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={dbId}
                                        onChange={e => setDbId(e.target.value)}
                                        placeholder="Database ID"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-text-tertiary focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/50 transition-all outline-none"
                                    />
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing || !notionKey || !dbId}
                                        className="w-full btn btn-primary py-2.5 text-[12px] justify-center shadow-lg shadow-accent-primary/10"
                                    >
                                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Export Last 10 Saves'}
                                    </button>
                                    <p className="text-[10px] text-text-tertiary leading-relaxed px-1">
                                        Requires a Notion Integration with access to the database. properties: Name, URL, Category, Tags, Summary.
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Spaced Repetition Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                        <Bell className="w-3.5 h-3.5 text-text-secondary" />
                                    </div>
                                    Spaced Repetition
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors ml-8">
                                    <div className="text-[11px] text-text-secondary pr-4">
                                        Trigger a "3 days ago" reminder check on WhatsApp.
                                    </div>
                                    <button
                                        onClick={handleRemind}
                                        disabled={reminding}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all shrink-0"
                                        title="Simulate Reminder"
                                    >
                                        {reminding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Predictive Context Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                        <Sparkles className="w-3.5 h-3.5 text-accent-secondary" />
                                    </div>
                                    Predictive Context
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">BETA</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors ml-8">
                                    <div className="text-[11px] text-text-secondary pr-4">
                                        Anticipate needs (e.g., Save flight → Get hotel suggestions).
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={predictiveMode}
                                            onChange={e => {
                                                setPredictiveMode(e.target.checked)
                                                localStorage.setItem('predictive_mode', e.target.checked)
                                            }}
                                        />
                                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary border border-white/5"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
