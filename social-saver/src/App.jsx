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

            let query = supabase
                .from('saves')
                .select('*')
                .order('created_at', { ascending: false })

            if (userPhone) query = query.eq('user_phone', userPhone)
            if (category && category !== 'All') query = query.eq('category', category)

            if (search && search.trim().length > 0) {
                query = query.textSearch('fts', search.trim(), { type: 'websearch' })
            }

            if (quickFilters.includes('instagram')) {
                query = query.eq('source', 'instagram')
            }
            if (quickFilters.includes('withNotes')) {
                query = query.not('note', 'is', null)
            }
            if (quickFilters.includes('recent')) {
                const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
                query = query.gte('created_at', weekAgo)
            }

            query = query.limit(50)
            const { data, error } = await query

            if (error) {
                console.error('Fetch error:', error)
                setSaves(applyQuickFilters(MOCK_SAVES))
            } else {
                setSaves(data || [])
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
        try {
            let query = supabase.from('saves').select('category, created_at')
            if (userPhone) query = query.eq('user_phone', userPhone)
            const { data, error } = await query
            if (!error && data) {
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

    // Realtime
    useEffect(() => {
        if (useMock) return
        const channel = supabase
            .channel('saves-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'saves' }, (payload) => {
                if (!userPhone || payload.new.user_phone === userPhone) {
                    setSaves(prev => [payload.new, ...prev])
                    fetchStats()

                    // 🔮 Predictive Context Trigger
                    const isPredicted = payload.new.status === 'predicted' || (payload.new.tags && payload.new.tags.includes('predicted'))
                    const modeEnabled = localStorage.getItem('predictive_mode') === 'true'

                    if (modeEnabled && !isPredicted) {
                        // Fire and forget prediction
                        fetch(`${import.meta.env.VITE_EDGE_FUNCTION_URL}/predictive-analysis`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ save: payload.new }),
                        }).then(res => res.json()).then(data => {
                            if (data.suggestions?.length > 0) {
                                const inserts = data.suggestions.map(s => ({
                                    ...s,
                                    user_phone: payload.new.user_phone,
                                    status: 'predicted',
                                    created_at: new Date().toISOString()
                                }))
                                supabase.from('saves').insert(inserts).then(({ error }) => {
                                    if (!error) toast.success(`🔮 Found ${inserts.length} related items!`)
                                })
                            }
                        }).catch(e => console.error('Prediction error:', e))
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'saves' }, (payload) => {
                if (!userPhone || payload.new.user_phone === userPhone) {
                    setSaves(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'saves' }, (payload) => {
                setSaves(prev => prev.filter(s => s.id !== payload.old.id))
                fetchStats()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userPhone, fetchStats, useMock])

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
        <div className="min-h-screen flex flex-col">
            <OnboardingOverlay />
            <Header totalSaves={stats.total} stats={stats} userPhone={userPhone} onLogoClick={() => setShowLanding(true)} />

            <main className="flex-1 w-full">
                <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '40px 24px' }}>
                    {/* Ask My Saves */}
                    <AskSaves saves={useMock ? MOCK_SAVES : saves} onFilterResults={setAskResults} />

                    {/* Section divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '48px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        <span style={{
                            fontSize: '13px',
                            color: 'var(--color-text-secondary)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                        }}>Your Saves</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-5">
                        <div className="flex-1 w-full">
                            <SearchBar value={search} onChange={setSearch} suggestions={searchSuggestions} />
                        </div>
                        <div className="flex items-center gap-2">
                            <RecapModal userPhone={userPhone} useMock={useMock} />
                            <RandomInspiration userPhone={userPhone} />
                        </div>
                    </div>

                    {/* Quick Filters + View Toggle */}
                    <div className="flex items-center justify-between mb-6 gap-3">
                        <div className="flex-1 min-w-0">
                            <QuickFilters active={quickFilters} onToggle={toggleQuickFilter} />
                        </div>
                        <div className="view-toggle shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={viewMode === 'grid' ? 'active' : ''}
                                title="Grid view"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('collections')}
                                className={viewMode === 'collections' ? 'active' : ''}
                                title="Collections"
                            >
                                <Layers className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('graph')}
                                className={viewMode === 'graph' ? 'active' : ''}
                                title="Knowledge Graph (Beta)"
                            >
                                <Network className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Category Chips */}
                    <div style={{ marginBottom: '32px' }}>
                        <CategoryChips selected={category} onSelect={setCategory} counts={stats.categories} />
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="saves-grid">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="card p-5 flex flex-col gap-3" style={{ minHeight: '200px' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="skel h-3 w-14 rounded-full" />
                                        <div className="skel h-2 w-2 rounded-full" />
                                    </div>
                                    <div className="skel h-5 w-20 rounded-full" />
                                    <div className="skel h-3 w-full rounded" />
                                    <div className="skel h-3 w-4/5 rounded" />
                                    <div className="skel h-3 w-3/5 rounded" />
                                    <div className="flex gap-1.5 mt-auto pt-2">
                                        <div className="skel h-4 w-12 rounded-full" />
                                        <div className="skel h-4 w-16 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displaySaves.length > 0 ? (
                        <>
                            {viewMode === 'graph' ? (
                                <KnowledgeGraph saves={displaySaves} />
                            ) : viewMode === 'collections' ? (
                                <CollectionsView saves={displaySaves} onDelete={handleDelete} onUpdate={handleUpdate} />
                            ) : (
                                <div className="saves-grid">
                                    {displaySaves.map(save => (
                                        <SaveCard key={save.id} save={save} onDelete={handleDelete} onUpdate={handleUpdate} />
                                    ))}
                                </div>
                            )}

                            {/* Export */}
                            <div className="flex justify-end mt-6">
                                <button onClick={exportCSV} className="btn btn-ghost text-[12px]" style={{ gap: '6px' }}>
                                    <Download className="w-3.5 h-3.5" />
                                    Export CSV
                                </button>
                            </div>
                        </>
                    ) : (
                        <EmptyState search={search} category={category} />
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '24px' }}>
                <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, #7c6dfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Social Saver
                        </span>
                        <span className="footer-text opacity-50">— save links via WhatsApp</span>
                    </div>
                    <span className="footer-text" style={{ opacity: 0.4 }}>Built for Hack180 ✦</span>
                </div>
            </footer>
        </div>
    )
}

export default App
