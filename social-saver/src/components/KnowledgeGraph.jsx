import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { ZoomIn, ZoomOut, Maximize2, X, Network, RefreshCw, Loader2, ChevronRight, ExternalLink } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const DEMO_KEY = import.meta.env.VITE_DEMO_KEY || ''
const EDGE_BASE = `${SUPABASE_URL}/functions/v1`

/* ── Colors ────────────────────────────────────────────────────────────────── */
const TYPE_COLORS = {
    exercise: '#3dd68c',
    food: '#fbbf24',
    tool: '#a78bfa',
    topic: '#60a5fa',
    concept: '#f472b6',
    brand: '#fb923c',
    person: '#34d399',
    other: '#6b7280',
    category: '#9ca3af',
}

const getColor = (type) => TYPE_COLORS[type?.toLowerCase()] || TYPE_COLORS.other

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function truncate(str, len) {
    if (!str) return ''
    return str.length > len ? str.slice(0, len) + '…' : str
}
function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return `rgba(107,114,128,${alpha})`
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

/* ── API calls ──────────────────────────────────────────────────────────────── */
async function fetchGraphData(userPhone, limitNodes = 40, minEdgeWeight = 0.5) {
    const res = await fetch(`${EDGE_BASE}/graph-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ user_phone: userPhone, limit_nodes: limitNodes, min_edge_weight: minEdgeWeight }),
    })
    if (!res.ok) throw new Error(`graph-query: ${res.status}`)
    return res.json()
}

async function fetchRelatedSaves(userPhone, entityKey, entityName, hops = 2) {
    const res = await fetch(`${EDGE_BASE}/graph-related-saves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ user_phone: userPhone, entity_key: entityKey, entity_name: entityName, hops }),
    })
    if (!res.ok) throw new Error(`graph-related-saves: ${res.status}`)
    return res.json()
}

async function triggerRebuild(userPhone, batchSize = 20) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` }
    if (DEMO_KEY) headers['X-DEMO-KEY'] = DEMO_KEY

    const res = await fetch(`${EDGE_BASE}/process-graph-jobs`, {
        method: 'POST', headers,
        body: JSON.stringify({ batch_size: batchSize }),
    })
    if (!res.ok) throw new Error(`process-graph-jobs: ${res.status}`)
    return res.json()
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function KnowledgeGraph({ saves, userPhone }) {
    const containerRef = useRef(null)
    const graphRef = useRef(null)
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 })

    // Graph state
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState(null)
    const [usingLiveData, setUsingLiveData] = useState(false)

    // Interaction state
    const [hoveredNode, setHoveredNode] = useState(null)
    const [highlightNodes, setHighlightNodes] = useState(new Set())
    const [highlightLinks, setHighlightLinks] = useState(new Set())

    // Drawer state
    const [drawerNode, setDrawerNode] = useState(null)
    const [drawerSaves, setDrawerSaves] = useState([])
    const [drawerLoading, setDrawerLoading] = useState(false)
    const [drawerError, setDrawerError] = useState(null)

    // Admin state
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === '1'
    const [rebuilding, setRebuilding] = useState(false)
    const [rebuildResult, setRebuildResult] = useState(null)

    // Responsive container
    useEffect(() => {
        function resize() {
            if (containerRef.current) {
                setDimensions({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight })
            }
        }
        resize()
        window.addEventListener('resize', resize)
        return () => window.removeEventListener('resize', resize)
    }, [])

    // Load graph data from Neo4j on mount
    useEffect(() => {
        if (!userPhone) return
        setLoading(true)
        setLoadError(null)
        fetchGraphData(userPhone)
            .then(data => {
                if (data.nodes?.length > 0) {
                    setGraphData(data)
                    setUsingLiveData(true)
                } else {
                    // No Neo4j data yet — fall back to local tag/category graph
                    setUsingLiveData(false)
                }
                setLoading(false)
            })
            .catch(err => {
                console.warn('[KnowledgeGraph] Neo4j not ready, using local data:', err.message)
                setUsingLiveData(false)
                setLoading(false)
            })
    }, [userPhone])

    // Build fallback LOCAL graph from saves (existing behavior)
    const localGraphData = useMemo(() => {
        if (!saves?.length) return { nodes: [], links: [], neighbors: {} }

        const nodes = [], links = [], nodeSet = new Set()
        const tagSaveMap = {}, neighbors = {}
        const categories = [...new Set(saves.map(s => s.category || 'Other'))]

        categories.forEach(cat => {
            const id = `cat-${cat}`
            nodes.push({ id, label: cat, type: 'category', size: 20, color: getColor('category') })
            nodeSet.add(id); neighbors[id] = new Set()
        })
        saves.forEach(save => {
            if (nodeSet.has(save.id)) return
            const cat = save.category || 'Other'
            nodes.push({ id: save.id, label: truncate(save.title || save.summary, 30), type: 'save', size: 8, color: getColor(cat.toLowerCase()), meta: save })
            nodeSet.add(save.id); neighbors[save.id] = new Set()
            links.push({ source: `cat-${cat}`, target: save.id, weight: 1 })
            neighbors[`cat-${cat}`]?.add(save.id); neighbors[save.id].add(`cat-${cat}`)
                ; (save.tags || []).forEach(tag => {
                    if (!tagSaveMap[tag]) tagSaveMap[tag] = []
                    tagSaveMap[tag].push(save.id)
                })
        })
        Object.entries(tagSaveMap).forEach(([tag, ids]) => {
            const id = `tag-${tag}`
            if (!nodeSet.has(id)) {
                nodes.push({ id, label: `#${tag}`, type: 'tag', size: 5 + ids.length * 1.5, color: '#6b7280' })
                nodeSet.add(id); neighbors[id] = new Set()
            }
            ids.forEach(sid => {
                links.push({ source: sid, target: id, weight: 0.5 })
                neighbors[sid]?.add(id); neighbors[id].add(sid)
            })
        })
        return { nodes, links, neighbors }
    }, [saves])

    // Decide which graph data to render
    const { fgNodes, fgLinks, neighbors } = useMemo(() => {
        if (usingLiveData && graphData.nodes.length > 0) {
            const nodes = graphData.nodes.map(n => ({
                ...n,
                val: n.size || 5,
                color: getColor(n.type),
            }))
            const links = (graphData.edges || []).map(e => ({
                source: e.source,
                target: e.target,
                weight: e.weight || 1,
            }))
            const neighbors = {}
            nodes.forEach(n => { neighbors[n.id] = new Set() })
            links.forEach(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source
                const t = typeof l.target === 'object' ? l.target.id : l.target
                neighbors[s]?.add(t); neighbors[t]?.add(s)
            })
            return { fgNodes: nodes, fgLinks: links, neighbors }
        }
        return {
            fgNodes: localGraphData.nodes.map(n => ({ ...n, val: n.size })),
            fgLinks: localGraphData.links || [],
            neighbors: localGraphData.neighbors || {},
        }
    }, [usingLiveData, graphData, localGraphData])

    // Hover logic
    const handleNodeHover = useCallback(node => {
        const hl = new Set(), hlLinks = new Set()
        if (node) {
            hl.add(node.id)
            neighbors[node.id]?.forEach(n => hl.add(n))
            fgLinks.forEach(link => {
                const s = typeof link.source === 'object' ? link.source.id : link.source
                const t = typeof link.target === 'object' ? link.target.id : link.target
                if (s === node.id || t === node.id) hlLinks.add(link)
            })
        }
        setHighlightNodes(hl); setHighlightLinks(hlLinks); setHoveredNode(node)
    }, [neighbors, fgLinks])

    // Node click → load related saves in drawer (live data only)
    const handleNodeClick = useCallback(node => {
        if (!usingLiveData || node.type === 'category') {
            setDrawerNode(node); setDrawerSaves([]); setDrawerError(null)
            return
        }
        setDrawerNode(node); setDrawerSaves([]); setDrawerError(null); setDrawerLoading(true)
        fetchRelatedSaves(userPhone, node.id, node.label, 2)
            .then(data => { setDrawerSaves(data.results || []); setDrawerLoading(false) })
            .catch(err => { setDrawerError(err.message); setDrawerLoading(false) })
    }, [usingLiveData, userPhone])

    // Admin: rebuild graph
    const handleRebuild = async () => {
        setRebuilding(true); setRebuildResult(null)
        try {
            const data = await triggerRebuild(userPhone, 20)
            setRebuildResult(data)
        } catch (err) {
            setRebuildResult({ error: err.message })
        } finally {
            setRebuilding(false)
        }
    }

    // Zoom
    const zoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.4, 300)
    const zoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() * 0.7, 300)
    const zoomFit = () => graphRef.current?.zoomToFit(400, 60)

    // Custom renderers
    const paintNode = useCallback((node, ctx, globalScale) => {
        const isHL = highlightNodes.size === 0 || highlightNodes.has(node.id)
        const alpha = isHL ? 1 : 0.12
        const r = Math.sqrt(node.val || 5) * 2.2

        if (highlightNodes.size > 0 && highlightNodes.has(node.id)) {
            ctx.beginPath(); ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI)
            ctx.fillStyle = hexToRgba(node.color, 0.18); ctx.fill()
        }
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = hexToRgba(node.color, alpha); ctx.fill()

        if (node.type === 'category') {
            ctx.strokeStyle = hexToRgba(node.color, alpha * 0.6)
            ctx.lineWidth = 1.5; ctx.stroke()
        }

        const showLabel = node.type === 'category'
            || globalScale > 0.9
            || highlightNodes.has(node.id)

        if (showLabel) {
            const fs = (node.type === 'category' ? 13 : 10) / globalScale
            ctx.font = `${node.type === 'category' ? 'bold' : '500'} ${fs}px Inter,sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'top'
            const label = truncate(node.label, 22)
            ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`
            ctx.fillText(label, node.x + 0.5, node.y + r + 4.5)
            ctx.fillStyle = node.type === 'category' ? hexToRgba('#fff', alpha) : hexToRgba('#e5e7eb', alpha * 0.9)
            ctx.fillText(label, node.x, node.y + r + 4)
        }
    }, [highlightNodes])

    const paintLink = useCallback((link, ctx) => {
        const isHL = highlightLinks.has(link)
        const src = link.source, tgt = link.target
        ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y)
        const w = link.weight || 1
        ctx.strokeStyle = isHL
            ? `rgba(139,92,246,${Math.min(0.8, w * 0.3 + 0.3)})`
            : (highlightLinks.size > 0 ? 'rgba(107,114,128,0.04)' : `rgba(107,114,128,${Math.min(0.25, w * 0.1 + 0.08)})`)
        ctx.lineWidth = isHL ? Math.min(w * 0.6 + 0.8, 3) : 0.8
        ctx.stroke()
    }, [highlightLinks])

    // Type legend
    const typeLegend = useMemo(() => {
        if (!usingLiveData) return []
        const types = [...new Set(fgNodes.map(n => n.type).filter(Boolean))]
        return types.map(t => ({ type: t, color: getColor(t) }))
    }, [fgNodes, usingLiveData])

    return (
        <div className="flex h-[640px] w-full gap-3">
            {/* ── Graph canvas ── */}
            <Card ref={containerRef} className="relative flex-1 overflow-hidden border-white/5 bg-[#080810] p-0 shadow-lg">
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080810]/80">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
                    </div>
                )}

                <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.w}
                    height={dimensions.h}
                    graphData={{ nodes: fgNodes, links: fgLinks }}
                    nodeCanvasObject={paintNode}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        const r = Math.sqrt(node.val || 5) * 2.2 + 5
                        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                        ctx.fillStyle = color; ctx.fill()
                    }}
                    linkCanvasObject={paintLink}
                    backgroundColor="transparent"
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.4}
                    warmupTicks={120}
                    cooldownTicks={300}
                    cooldownTime={2000}
                    onEngineStop={() => {
                        if (graphRef.current) {
                            fgNodes.forEach(n => { n.fx = n.x; n.fy = n.y })
                            graphRef.current.zoomToFit(400, 60)
                        }
                    }}
                    onNodeHover={handleNodeHover}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={() => setDrawerNode(null)}
                    enableNodeDrag={false}
                    enableZoomInteraction={true}
                    enablePanInteraction={true}
                />

                {/* ── Top-left badge ── */}
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e0e1a]/80 px-3 py-2 backdrop-blur-md">
                    <Network className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-xs font-bold text-white">
                        {usingLiveData ? 'Knowledge Graph' : 'Category Graph'}
                    </span>
                    {usingLiveData && (
                        <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                            LIVE · Neo4j
                        </span>
                    )}
                </div>

                {/* ── Type legend (live mode) ── */}
                {typeLegend.length > 0 && (
                    <div className="absolute left-4 top-14 rounded-xl border border-white/10 bg-[#0e0e1a]/80 p-3 backdrop-blur-md">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Entity types</div>
                        {typeLegend.map(({ type, color }) => (
                            <div key={type} className="flex items-center gap-2 py-0.5">
                                <div className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}88` }} />
                                <span className="text-[11px] capitalize text-white/50">{type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Zoom controls ── */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                    {[
                        { icon: ZoomIn, onClick: zoomIn, title: 'Zoom in' },
                        { icon: ZoomOut, onClick: zoomOut, title: 'Zoom out' },
                        { icon: Maximize2, onClick: zoomFit, title: 'Fit' },
                    ].map(({ icon: Icon, onClick, title }, i) => (
                        <Button key={i} variant="secondary" size="icon" onClick={onClick} title={title}
                            className="h-8 w-8 rounded-lg border-white/10 bg-[#0e0e1a]/80 text-white/60 backdrop-blur-md hover:bg-white/10 hover:text-white">
                            <Icon className="h-4 w-4" />
                        </Button>
                    ))}
                </div>

                {/* ── Admin: Rebuild Graph button ── */}
                {isAdmin && (
                    <div className="absolute bottom-4 left-4">
                        <div className="flex flex-col gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleRebuild}
                                disabled={rebuilding}
                                className="border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs"
                            >
                                {rebuilding
                                    ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Building…</>
                                    : <><RefreshCw className="mr-1.5 h-3 w-3" />Rebuild Graph</>}
                            </Button>
                            {rebuildResult && (
                                <div className="rounded-lg border border-white/10 bg-[#0e0e1a]/90 p-2 text-[10px] text-white/60">
                                    {rebuildResult.error
                                        ? <span className="text-red-400">Error: {rebuildResult.error}</span>
                                        : <span>✅ {rebuildResult.processed} processed, {rebuildResult.errors} errors</span>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Status: no live data ── */}
                {!loading && !usingLiveData && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
                        {isAdmin
                            ? 'Neo4j not configured yet. Add secrets and click "Rebuild Graph".'
                            : 'Showing local tag graph. Add Neo4j credentials for the real entity graph.'}
                    </div>
                )}
            </Card>

            {/* ── Right Drawer: related saves ── */}
            {drawerNode && (
                <div className="flex w-80 flex-col rounded-xl border border-white/10 bg-[#0e0e1a]/95 backdrop-blur-xl shadow-2xl">
                    {/* Drawer header */}
                    <div className="flex items-start justify-between border-b border-white/10 p-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: getColor(drawerNode.type) }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                    {drawerNode.type || 'node'}
                                </span>
                            </div>
                            <h3 className="text-sm font-bold text-white leading-relaxed truncate">
                                {drawerNode.label}
                            </h3>
                        </div>
                        <button
                            onClick={() => setDrawerNode(null)}
                            className="ml-2 flex-shrink-0 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Drawer content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {drawerLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                            </div>
                        )}
                        {drawerError && (
                            <p className="text-xs text-red-400 p-2">{drawerError}</p>
                        )}
                        {!drawerLoading && !drawerError && drawerSaves.length === 0 && (
                            <p className="text-xs text-white/40 py-4 text-center">No related saves found</p>
                        )}
                        {drawerSaves.map((save, i) => (
                            <div key={`${save.save_id}-${i}`}
                                className="mb-3 rounded-lg border border-white/5 bg-white/3 p-3 hover:bg-white/5 transition-colors">
                                <a href={save.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-start gap-2 group">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white leading-snug mb-1 group-hover:text-[var(--color-accent)] transition-colors">
                                            {truncate(save.title, 60)}
                                        </p>
                                        {save.summary && (
                                            <p className="text-[10px] text-white/40 leading-relaxed">
                                                {truncate(save.summary, 80)}
                                            </p>
                                        )}
                                        {/* Why chip */}
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <span className={cn(
                                                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                                save.path_kind === 'direct'
                                                    ? "bg-green-500/15 text-green-400"
                                                    : "bg-purple-500/15 text-purple-400"
                                            )}>
                                                {save.path_kind === 'direct'
                                                    ? `↳ ${save.matched_entity}`
                                                    : `↳ ${save.via_entity} → ${save.matched_entity}`}
                                            </span>
                                        </div>
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-white/20 group-hover:text-white/60 mt-0.5" />
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* Drawer footer */}
                    {usingLiveData && drawerSaves.length > 0 && (
                        <div className="border-t border-white/5 p-3">
                            <p className="text-[10px] text-white/30 text-center">
                                {drawerSaves.length} saves · 2-hop graph traversal
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
