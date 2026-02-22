import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import { useToast } from './components/Toast'
import SearchBar from './components/SearchBar'
import CategoryChips from './components/CategoryChips'
import SaveCard from './components/SaveCard'
import RandomInspiration from './components/RandomInspiration'
import RecapModal from './components/RecapModal'
import QuickFilters from './components/QuickFilters'
import AskSaves from './components/AskSaves'
import CollectionsView from './components/CollectionsView'
import OnboardingOverlay from './components/OnboardingOverlay'
import Header from './components/Header'
import EmptyState from './components/EmptyState'
import LandingPage from './components/LandingPage'
import KnowledgeGraph from './components/KnowledgeGraph'
import { Download, LayoutGrid, Layers, Network } from 'lucide-react'
import { Button } from './components/ui/Button'
import { cn } from './lib/utils'

// Mock data for local dev / demo when Supabase isn't connected
const MOCK_SAVES = [
    { id: '1', created_at: new Date(Date.now() - 120000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C1abc/', source: 'instagram', title: 'Core workout routine', category: 'Fitness', tags: ['core', 'abs', 'workout', 'home'], summary: 'A quick 5-min standing ab circuit—great for daily core strength without equipment.', status: 'complete', note: null, action_steps: ['30s plank hold', '20 standing crunches', '15 bicycle kicks each side'] },
    { id: '2', created_at: new Date(Date.now() - 3600000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/p/C2def/', source: 'instagram', title: 'One-pot pasta recipe', category: 'Food', tags: ['pasta', 'recipe', 'quick', 'dinner'], summary: 'Creamy garlic tuscan pasta in one pot under 20 min—perfect weeknight dinner.', status: 'complete', note: null, action_steps: ['Sauté garlic + sun-dried tomatoes', 'Add pasta + broth + cream', 'Simmer 12 min, stir in spinach'] },
    { id: '3', created_at: new Date(Date.now() - 7200000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C3ghi/', source: 'instagram', title: 'React Hooks tips', category: 'Coding', tags: ['react', 'hooks', 'javascript', 'frontend'], summary: 'Three useEffect anti-patterns—avoid stale closures and infinite loops.', status: 'complete', note: null, action_steps: ['Use cleanup functions for subscriptions', 'Memoize objects in dependency arrays', 'Prefer useCallback for event handlers'] },
    { id: '4', created_at: new Date(Date.now() - 86400000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C4jkl/', source: 'instagram', title: null, category: 'Travel', tags: ['bali', 'travel', 'beach', 'sunset'], summary: 'Hidden beach in Bali with crystal clear water—no crowds, no tourists.', status: 'complete', note: null, action_steps: [] },
    { id: '5', created_at: new Date(Date.now() - 172800000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/p/C5mno/', source: 'instagram', title: 'UI design trends 2026', category: 'Design', tags: ['ui', 'design', 'trends', 'minimal'], summary: 'Top 5 UI design trends dominating 2026—bento grids are everywhere.', status: 'complete', note: null, action_steps: [] },
    { id: '6', created_at: new Date(Date.now() - 259200000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C6pqr/', source: 'instagram', title: 'Morning routine habits', category: 'Self-Improvement', tags: ['morning', 'habits', 'productivity'], summary: 'Neuroscientist-backed morning routine—cold exposure + sunlight for peak focus.', status: 'complete', note: null, action_steps: [] },
    { id: '7', created_at: new Date(Date.now() - 345600000).toISOString(), user_phone: 'demo', url: 'https://x.com/elonmusk/status/12345', source: 'x', title: 'Startup advice thread', category: 'Business', tags: ['startup', 'advice', 'growth', 'funding'], summary: 'Common fundraising mistakes first-time founders make—avoid these 5 pitfalls.', status: 'complete', note: null, action_steps: [] },
    { id: '8', created_at: new Date(Date.now() - 600000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C7stu/', source: 'instagram', title: null, category: 'Other', tags: ['meme', 'funny'], summary: 'Saved link (add a note to improve).', status: 'pending_note', note: null, action_steps: [] },
    { id: '9', created_at: new Date(Date.now() - 5400000).toISOString(), user_phone: 'demo', url: 'https://www.instagram.com/reel/C8vwx/', source: 'instagram', title: 'Resistance band workout', category: 'Fitness', tags: ['back', 'resistance', 'bands', 'strength'], summary: 'Full back workout using only resistance bands—great for travel days.', status: 'complete', note: 'My favorite back day routine', action_steps: ['3×12 band pull-aparts', '3×10 seated rows', '2×15 face pulls'] },
]

function App() {
    const params = new URLSearchParams(window.location.search)
    const userPhone = params.get('u') || params.get('phone') || import.meta.env.VITE_DEMO_PHONE || ''
    const hasUserParam = !!(params.get('u') || params.get('phone'))

    const [showLanding, setShowLanding] = useState(!hasUserParam)
    const [saves, setSaves] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('All')
    const [stats, setStats] = useState({ total: 0, categories: {}, weekCount: 0 })
    const [quickFilters, setQuickFilters] = useState([])
    const [viewMode, setViewMode] = useState('grid') // 'grid' | 'collections'
    const [askResults, setAskResults] = useState(null)
    const toast = useToast()

    const useMock = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

    // Compute search suggestions from all saves
    const searchSuggestions = useMemo(() => {
        const source = useMock ? MOCK_SAVES : saves
        const tagCounts = {}
        source.forEach(s => {
            (s.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
        })
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([t]) => t)
    }, [saves, useMock])

    // Apply quick filters client-side
    const applyQuickFilters = useCallback((data) => {
        let filtered = [...data]
        if (quickFilters.includes('instagram')) {
            filtered = filtered.filter(s => s.source === 'instagram')
        }
        if (quickFilters.includes('withNotes')) {
            filtered = filtered.filter(s => s.note && s.note.trim())
        }
        if (quickFilters.includes('recent')) {
            const weekAgo = Date.now() - 7 * 86400000
            filtered = filtered.filter(s => new Date(s.created_at).getTime() > weekAgo)
        }
        return filtered
    }, [quickFilters])

    const fetchSaves = useCallback(async () => {
        setLoading(true)
        try {
            if (useMock) {
                let filtered = [...MOCK_SAVES]
                if (category && category !== 'All') {
                    filtered = filtered.filter(s => s.category === category)
                }
                if (search && search.trim()) {
                    const q = search.toLowerCase()
                    filtered = filtered.filter(s =>
                        (s.summary || '').toLowerCase().includes(q) ||
                        (s.title || '').toLowerCase().includes(q) ||
                        (s.note || '').toLowerCase().includes(q) ||
                        s.tags.some(t => t.toLowerCase().includes(q)) ||
                        s.url.toLowerCase().includes(q)
                    )
                }
                setSaves(applyQuickFilters(filtered))
                setLoading(false)
                return
            }

            // Build query params for get-saves edge function
            const params = new URLSearchParams({ phone: userPhone, limit: '50' })
            if (category && category !== 'All') params.set('category', category)
            if (search && search.trim()) params.set('search', search.trim())
            if (quickFilters.includes('instagram')) params.set('source', 'instagram')
            if (quickFilters.includes('withNotes')) params.set('with_notes', 'true')
            if (quickFilters.includes('recent')) {
                params.set('recent_since', new Date(Date.now() - 7 * 86400000).toISOString())
            }

            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/get-saves?${params}`, {
                headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            })

            if (!res.ok) throw new Error(`get-saves: ${res.status}`)
            const data = await res.json()

            if (data.error) {
                console.error('Fetch error:', data.error)
                setSaves(applyQuickFilters(MOCK_SAVES))
            } else {
                setSaves(Array.isArray(data) ? data : [])
            }
        } catch (err) {
            console.error('Fetch failed:', err)
            setSaves(applyQuickFilters(MOCK_SAVES))
        }
        setLoading(false)
    }, [search, category, userPhone, useMock, quickFilters, applyQuickFilters])

    const fetchStats = useCallback(async () => {
        if (useMock) {
            const cats = {}
            MOCK_SAVES.forEach(s => { cats[s.category] = (cats[s.category] || 0) + 1 })
            const weekAgo = Date.now() - 7 * 86400000
            const weekCount = MOCK_SAVES.filter(s => new Date(s.created_at).getTime() > weekAgo).length
            setStats({ total: MOCK_SAVES.length, categories: cats, weekCount })
            return
        }
        if (!userPhone) return
        try {
            const edgeFnUrl = import.meta.env.VITE_EDGE_FUNCTION_URL || ''
            const res = await fetch(`${edgeFnUrl}/get-saves?stats=true&phone=${encodeURIComponent(userPhone)}`, {
                headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            })
            const data = await res.json()
            if (!data.error && Array.isArray(data)) {
                const cats = {}
                const weekAgo = Date.now() - 7 * 86400000
                let weekCount = 0
                data.forEach(row => {
                    cats[row.category] = (cats[row.category] || 0) + 1
                    if (new Date(row.created_at).getTime() > weekAgo) weekCount++
                })
                setStats({ total: data.length, categories: cats, weekCount })
            }
        } catch (err) { console.error('Stats error:', err) }
    }, [userPhone, useMock])

    useEffect(() => { fetchSaves() }, [fetchSaves])
    useEffect(() => { fetchStats() }, [fetchStats])

    // Realtime — use as cache invalidation only (do NOT use payload.new directly;
    // the anon key cannot SELECT after RLS lockdown, so we re-fetch via edge function)
    useEffect(() => {
        if (useMock) return
        const channel = supabase
            .channel('saves-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'saves' }, () => {
                fetchSaves()
                fetchStats()
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'saves' }, () => {
                fetchSaves()
                fetchStats()
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'saves' }, () => {
                fetchSaves()
                fetchStats()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userPhone, fetchSaves, fetchStats, useMock])

    // Handlers
    const handleDelete = (id) => {
        setSaves(prev => prev.filter(s => s.id !== id))
        setStats(prev => ({ ...prev, total: prev.total - 1 }))
    }

    const handleUpdate = (updated) => {
        setSaves(prev => prev.map(s => s.id === updated.id ? updated : s))
    }

    const toggleQuickFilter = (key) => {
        setQuickFilters(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    const exportCSV = () => {
        const headers = ['Title', 'URL', 'Category', 'Summary', 'Tags', 'Note', 'Source', 'Created']
        const rows = saves.map(s => [
            s.title || '', s.url, s.category, s.summary || '',
            (s.tags || []).join('; '), s.note || '', s.source,
            new Date(s.created_at).toLocaleDateString()
        ])
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `social-saver-export-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('CSV exported')
    }

    // Use askResults when available, otherwise use regular saves
    const displaySaves = askResults || saves

    if (showLanding) {
        return <LandingPage onEnterDashboard={() => setShowLanding(false)} />
    }

    return (
        <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[#f0f0ff] antialiased selection:bg-[var(--color-accent)]/30 selection:text-white">
            <OnboardingOverlay />
            <Header totalSaves={stats.total} stats={stats} userPhone={userPhone} onLogoClick={() => setShowLanding(true)} />

            <main className="flex-1 pt-24 pb-12">
                <div className="mx-auto max-w-6xl px-6">
                    {/* Ask My Saves - Hero Section */}
                    <div className="mb-12">
                        <AskSaves saves={useMock ? MOCK_SAVES : saves} userPhone={userPhone} onFilterResults={setAskResults} />
                    </div>

                    {/* Section Header */}
                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-xs font-bold uppercase tracking-widest text-[#5a5a80]">
                            Your Content Library
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Filters & Controls */}
                    <div className="mb-8 rounded-2xl border border-white/5 bg-[#0e0e1a]/40 backdrop-blur-xl shadow-2xl shadow-black/20 relative z-20">
                        <div className="flex flex-col gap-0 p-1">
                            {/* Search & Actions Row */}
                            <div className="flex flex-col md:flex-row gap-4 p-4 pb-2">
                                <div className="flex-1 relative z-30">
                                    <SearchBar value={search} onChange={setSearch} suggestions={searchSuggestions} />
                                </div>
                                <div className="flex items-center gap-2 pl-0 md:pl-2">
                                    <RecapModal userPhone={userPhone} useMock={useMock} />
                                    <RandomInspiration userPhone={userPhone} />
                                </div>
                            </div>

                            {/* Filter Bar Row */}
                            <div className="flex flex-col gap-3 px-4 pb-4 pt-1 lg:flex-row lg:items-center lg:justify-between relative z-10">
                                <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center overflow-x-auto scrollbar-none">
                                    <QuickFilters active={quickFilters} onToggle={toggleQuickFilter} />
                                    <div className="hidden h-4 w-px bg-white/5 lg:block" />
                                    <CategoryChips selected={category} onSelect={setCategory} counts={stats.categories} />
                                </div>

                                {/* View Toggles */}
                                <div className="hidden lg:flex shrink-0 items-center gap-1 rounded-lg border border-white/5 bg-[#080810]/50 p-1 ml-auto">
                                    {[
                                        { id: 'grid', icon: LayoutGrid, title: 'Grid View' },
                                        { id: 'collections', icon: Layers, title: 'Collections' },
                                        { id: 'graph', icon: Network, title: 'Knowledge Graph' }
                                    ].map(({ id, icon: Icon, title }) => (
                                        <button
                                            key={id}
                                            onClick={() => setViewMode(id)}
                                            title={title}
                                            aria-label={title}
                                            aria-pressed={viewMode === id}
                                            className={cn(
                                                "flex items-center justify-center rounded-md p-1.5 transition-all",
                                                viewMode === id
                                                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-2)] shadow-sm"
                                                    : "text-[#5a5a80] hover:bg-white/5 hover:text-[#9090b8]"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    {loading ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex h-56 flex-col gap-4 rounded-2xl border border-white/5 bg-[#0e0e1a]/40 p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-3 w-16 animate-pulse rounded-full bg-white/5" />
                                        <div className="h-2 w-2 animate-pulse rounded-full bg-white/5" />
                                    </div>
                                    <div className="h-6 w-32 animate-pulse rounded-lg bg-white/10" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                                        <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                                        <div className="h-3 w-3/5 animate-pulse rounded bg-white/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displaySaves.length > 0 ? (
                        <>
                            {viewMode === 'graph' ? (
                                <KnowledgeGraph saves={displaySaves} userPhone={userPhone} />
                            ) : viewMode === 'collections' ? (
                                <CollectionsView saves={displaySaves} onDelete={handleDelete} onUpdate={handleUpdate} />
                            ) : (
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {displaySaves.map(save => (
                                        <SaveCard key={save.id} save={save} onDelete={handleDelete} onUpdate={handleUpdate} />
                                    ))}
                                </div>
                            )}

                            {/* Export */}
                            <div className="mt-8 flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={exportCSV}
                                    className="text-xs text-[#5a5a80] hover:text-[#9090b8]"
                                >
                                    <Download className="mr-2 h-3.5 w-3.5" />
                                    Export to CSV
                                </Button>
                            </div>
                        </>
                    ) : (
                        <EmptyState search={search} category={category} />
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-12 border-t border-white/5 bg-[#080810] py-8">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] bg-clip-text text-sm font-bold text-transparent">
                            Social Saver
                        </span>
                        <span className="text-xs font-medium text-[#5a5a80]">
                            — save links via WhatsApp
                        </span>
                    </div>
                    <span className="text-xs font-medium text-[#5a5a80]/60">
                        Built for Hack180 ✦
                    </span>
                </div>
            </footer>
        </div>
    )
}

export default App
