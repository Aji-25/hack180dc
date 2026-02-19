import { useState, useEffect } from 'react'
import { RefreshCw, Database, Bell, Check, X, Loader2, ArrowRight, Sparkles } from 'lucide-react'
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
                className="btn btn-ghost"
                title="Sync & Tools"
            >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sync</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div className="bg-[#191918] border border-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-border flex items-center justify-between bg-bg-raised">
                            <h3 className="font-semibold text-[14px] flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-accent" />
                                Sync & Automations
                            </h3>
                            <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* Notion Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-text">
                                    <Database className="w-3.5 h-3.5" />
                                    Notion Sync
                                </div>
                                <div className="space-y-2">
                                    <input
                                        type="password"
                                        value={notionKey}
                                        onChange={e => setNotionKey(e.target.value)}
                                        placeholder="Notion Integration Token (secret_...)"
                                        className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-[12px] text-text outline-none focus:border-accent transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={dbId}
                                        onChange={e => setDbId(e.target.value)}
                                        placeholder="Database ID"
                                        className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-[12px] text-text outline-none focus:border-accent transition-colors"
                                    />
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing || !notionKey || !dbId}
                                        className="w-full btn btn-primary py-2 text-[12px] justify-center"
                                    >
                                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Export Last 10 Saves'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-text-tertiary leading-relaxed">
                                    Requires a Notion Integration with access to the database. properties: Name, URL, Category, Tags, Summary.
                                </p>
                            </div>

                            <div className="h-px bg-border-subtle" />

                            {/* Spaced Repetition Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-text">
                                    <Bell className="w-3.5 h-3.5" />
                                    Spaced Repetition (WhatsApp)
                                </div>
                                <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border-subtle">
                                    <div className="text-[11px] text-text-secondary">
                                        Trigger a "3 days ago" reminder check manually.
                                    </div>
                                    <button
                                        onClick={handleRemind}
                                        disabled={reminding}
                                        className="btn btn-ghost hover:bg-accent/10 hover:text-accent border border-border h-8 w-8 p-0 flex items-center justify-center rounded-lg"
                                        title="Simulate Reminder"
                                    >
                                        {reminding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="h-px bg-border-subtle" />

                            {/* Predictive Context Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-text">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Predictive Context (Beta)
                                </div>
                                <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border-subtle">
                                    <div className="text-[11px] text-text-secondary">
                                        Anticipate needs (e.g., Save flight → Get hotel suggestions).
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={predictiveMode}
                                            onChange={e => {
                                                setPredictiveMode(e.target.checked)
                                                localStorage.setItem('predictive_mode', e.target.checked)
                                            }}
                                        />
                                        <div className="w-9 h-5 bg-border rounded-full peer peer-focus:ring-2 peer-focus:ring-accent/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
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
