import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Database, Bell, Check, X, Loader2, ArrowRight, Sparkles, Settings } from 'lucide-react'
import { useToast } from './Toast'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { motion, AnimatePresence } from 'framer-motion'

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
            <Button
                onClick={() => setOpen(true)}
                variant="ghost"
                className="text-white/60 hover:text-white"
                title="Sync & Tools"
            >
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
            </Button>

            {createPortal(
                <AnimatePresence>
                    {open && (
                        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 overflow-y-auto">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setOpen(false)}
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl shadow-2xl shadow-[var(--color-accent)]/10 ring-1 ring-white/5 max-h-[85vh] flex flex-col"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header with Close Button */}
                                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#161616] rounded-t-2xl shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                                            <Settings className="w-4 h-4 text-[var(--color-accent)]" />
                                        </div>
                                        <span className="text-base font-bold text-white">Settings</span>
                                    </div>
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-all duration-200 cursor-pointer"
                                        title="Close"
                                        aria-label="Close settings"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-8 relative z-10 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                    {/* Notion Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                                <Database className="w-3.5 h-3.5 text-white/60" />
                                            </div>
                                            Notion Sync
                                        </div>
                                        <div className="space-y-3 pl-8">
                                            <Input
                                                type="password"
                                                value={notionKey}
                                                onChange={e => setNotionKey(e.target.value)}
                                                placeholder="Integration Token (secret_...)"
                                            />
                                            <Input
                                                type="text"
                                                value={dbId}
                                                onChange={e => setDbId(e.target.value)}
                                                placeholder="Database ID"
                                            />
                                            <Button
                                                onClick={handleSync}
                                                disabled={syncing || !notionKey || !dbId}
                                                className="w-full justify-center shadow-lg shadow-[var(--color-accent)]/10"
                                            >
                                                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : 'Export Last 10 Saves'}
                                            </Button>
                                            <p className="text-[10px] text-white/40 leading-relaxed px-1">
                                                Requires a Notion Integration with access to the database. properties: Name, URL, Category, Tags, Summary.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/5" />

                                    {/* Spaced Repetition Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                                <Bell className="w-3.5 h-3.5 text-white/60" />
                                            </div>
                                            Spaced Repetition
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors ml-8">
                                            <div className="text-[11px] text-white/60 pr-4">
                                                Trigger a "3 days ago" reminder check on WhatsApp.
                                            </div>
                                            <Button
                                                onClick={handleRemind}
                                                disabled={reminding}
                                                variant="secondary"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                title="Simulate Reminder"
                                            >
                                                {reminding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/5" />

                                    {/* Predictive Context Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent-2)]" />
                                            </div>
                                            Predictive Context
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)] border border-[var(--color-accent-2)]/20 font-medium">BETA</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors ml-8">
                                            <div className="text-[11px] text-white/60 pr-4">
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
                                                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)] border border-white/5"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
