import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'

/* ── Category Colors ── */
const CAT_COLORS = {
    Fitness: '#3dd68c',
    Food: '#fbbf24',
    Coding: '#a78bfa',
    Travel: '#1da1f2',
    Design: '#e1306c',
    Business: '#60a5fa',
    'Self-Improvement': '#f472b6',
    Other: '#9ca3af',
}

/* ── Helpers ── */
function truncate(str, len) {
    if (!str) return ''
    return str.length > len ? str.slice(0, len) + '…' : str
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

export default function KnowledgeGraph({ saves }) {
    const containerRef = useRef(null)
    const graphRef = useRef(null)
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 })
    const [hoveredNode, setHoveredNode] = useState(null)
    const [selectedNode, setSelectedNode] = useState(null)
    const [highlightNodes, setHighlightNodes] = useState(new Set())
    const [highlightLinks, setHighlightLinks] = useState(new Set())

    /* ── Responsive container ── */
    useEffect(() => {
        function resize() {
            if (containerRef.current) {
                setDimensions({
                    w: containerRef.current.clientWidth,
                    h: containerRef.current.clientHeight,
                })
            }
        }
        resize()
        window.addEventListener('resize', resize)
        return () => window.removeEventListener('resize', resize)
    }, [])

    /* ── Build graph data ── */
    const { nodes, links, neighbors, categoryStats } = useMemo(() => {
        const nodes = []
        const links = []
        const nodeSet = new Set()
        const tagSaveMap = {} // tag → [saveIds]
        const neighbors = {}  // nodeId → Set<nodeId>
        const catCounts = {}

        // 1) Create category hub nodes
        const categories = [...new Set(saves.map(s => s.category || 'Other'))]
        categories.forEach(cat => {
            const catId = `cat-${cat}`
            nodes.push({
                id: catId,
                name: cat,
                val: 22,
                group: 'category',
                color: CAT_COLORS[cat] || '#9ca3af',
            })
            nodeSet.add(catId)
            neighbors[catId] = new Set()
            catCounts[cat] = 0
        })

        // 2) Create save nodes + category→save links
        saves.forEach(save => {
            if (nodeSet.has(save.id)) return
            const cat = save.category || 'Other'
            const catId = `cat-${cat}`
            catCounts[cat] = (catCounts[cat] || 0) + 1

            nodes.push({
                id: save.id,
                name: save.title || truncate(save.summary, 40) || 'Untitled',
                val: 10,
                group: 'save',
                color: CAT_COLORS[cat] || '#9ca3af',
                category: cat,
                url: save.url,
                summary: save.summary,
                source: save.source,
                tags: save.tags || [],
            })
            nodeSet.add(save.id)
            neighbors[save.id] = new Set()

            // category → save link
            links.push({ source: catId, target: save.id, type: 'cat-save' })
            neighbors[catId].add(save.id)
            neighbors[save.id].add(catId)

            // index tags
            if (save.tags) {
                save.tags.forEach(tag => {
                    if (!tagSaveMap[tag]) tagSaveMap[tag] = []
                    tagSaveMap[tag].push(save.id)
                })
            }
        })

        // 3) Create tag nodes + save→tag links
        Object.entries(tagSaveMap).forEach(([tag, saveIds]) => {
            const tagId = `tag-${tag}`
            if (!nodeSet.has(tagId)) {
                // Size tags by how many saves use them
                const tagVal = Math.min(4 + saveIds.length * 2, 12)
                nodes.push({
                    id: tagId,
                    name: `#${tag}`,
                    val: tagVal,
                    group: 'tag',
                    color: '#6b7280',
                    connectedSaves: saveIds.length,
                })
                nodeSet.add(tagId)
                neighbors[tagId] = new Set()
            }

            saveIds.forEach(saveId => {
                links.push({ source: saveId, target: tagId, type: 'save-tag' })
                if (neighbors[saveId]) neighbors[saveId].add(tagId)
                if (neighbors[tagId]) neighbors[tagId].add(saveId)
            })
        })

        const categoryStats = Object.entries(catCounts).map(([name, count]) => ({
            name,
            count,
            color: CAT_COLORS[name] || '#9ca3af',
        })).sort((a, b) => b.count - a.count)

        return { nodes, links, neighbors, categoryStats }
    }, [saves])

    /* ── Hover logic ── */
    const handleNodeHover = useCallback(node => {
        const hl = new Set()
        const hlLinks = new Set()

        if (node) {
            hl.add(node.id)
            const nbrs = neighbors[node.id]
            if (nbrs) nbrs.forEach(n => hl.add(n))

            links.forEach(link => {
                const srcId = typeof link.source === 'object' ? link.source.id : link.source
                const tgtId = typeof link.target === 'object' ? link.target.id : link.target
                if (srcId === node.id || tgtId === node.id) hlLinks.add(link)
            })
        }

        setHighlightNodes(hl)
        setHighlightLinks(hlLinks)
        setHoveredNode(node)
    }, [neighbors, links])

    /* ── Click logic ── */
    const handleNodeClick = useCallback(node => {
        if (node.group === 'save' && node.url) {
            setSelectedNode(prev => prev?.id === node.id ? null : node)
        } else if (node.group === 'category') {
            setSelectedNode(prev => prev?.id === node.id ? null : node)
        } else if (node.group === 'tag') {
            setSelectedNode(prev => prev?.id === node.id ? null : node)
        }
    }, [])

    /* ── Zoom controls ── */
    const zoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.4, 300)
    const zoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() * 0.7, 300)
    const zoomFit = () => graphRef.current?.zoomToFit(400, 60)

    /* ── Custom node renderer ── */
    const paintNode = useCallback((node, ctx, globalScale) => {
        const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id)
        const alpha = isHighlighted ? 1 : 0.15
        const r = Math.sqrt(node.val) * 2

        // Glow for highlighted nodes
        if (highlightNodes.size > 0 && highlightNodes.has(node.id)) {
            ctx.beginPath()
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI)
            ctx.fillStyle = hexToRgba(node.color, 0.15)
            ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = hexToRgba(node.color, alpha)
        ctx.fill()

        // Border for category nodes
        if (node.group === 'category') {
            ctx.strokeStyle = hexToRgba(node.color, alpha * 0.6)
            ctx.lineWidth = 1.5
            ctx.stroke()
        }

        // Labels
        const showLabel = node.group === 'category'
            || (node.group === 'save' && globalScale > 0.7)
            || (highlightNodes.has(node.id) && node.group !== 'tag')
        const showTagLabel = node.group === 'tag' && highlightNodes.has(node.id)

        if (showLabel || showTagLabel) {
            const fontSize = node.group === 'category' ? 13 / globalScale
                : node.group === 'save' ? 10 / globalScale
                    : 9 / globalScale
            ctx.font = `${node.group === 'category' ? 'bold' : '500'} ${fontSize}px Inter, system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            const label = node.group === 'category' ? node.name
                : node.group === 'tag' ? node.name
                    : truncate(node.name, 24)

            // Text shadow for readability
            ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`
            ctx.fillText(label, node.x + 0.5, node.y + r + 4 + 0.5)

            // Text
            ctx.fillStyle = node.group === 'category'
                ? hexToRgba('#ffffff', alpha)
                : node.group === 'tag'
                    ? hexToRgba('#9ca3af', alpha)
                    : hexToRgba('#e5e7eb', alpha * 0.9)
            ctx.fillText(label, node.x, node.y + r + 4)
        }
    }, [highlightNodes])

    /* ── Custom link renderer ── */
    const paintLink = useCallback((link, ctx) => {
        const isHL = highlightLinks.has(link)
        const src = link.source
        const tgt = link.target

        ctx.beginPath()
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)

        if (link.type === 'cat-save') {
            const color = typeof src === 'object' ? src.color : '#9ca3af'
            ctx.strokeStyle = hexToRgba(color, isHL ? 0.6 : (highlightLinks.size > 0 ? 0.04 : 0.2))
            ctx.lineWidth = isHL ? 2 : 1
        } else {
            ctx.strokeStyle = isHL
                ? 'rgba(107,114,128,0.5)'
                : (highlightLinks.size > 0 ? 'rgba(107,114,128,0.03)' : 'rgba(107,114,128,0.12)')
            ctx.lineWidth = isHL ? 1.5 : 0.5
        }

        ctx.stroke()
    }, [highlightLinks])

    /* ── Tooltip for selected node ── */
    const renderTooltip = () => {
        if (!selectedNode) return null

        if (selectedNode.group === 'save') {
            return (
                <div className="kg-tooltip">
                    <button className="kg-tooltip-close" onClick={() => setSelectedNode(null)}>
                        <X style={{ width: '14px', height: '14px' }} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: selectedNode.color, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                            {selectedNode.source} · {selectedNode.category}
                        </span>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '8px', lineHeight: 1.4 }}>
                        {selectedNode.name}
                    </h4>
                    {selectedNode.summary && (
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '12px' }}>
                            {truncate(selectedNode.summary, 120)}
                        </p>
                    )}
                    {selectedNode.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                            {selectedNode.tags.map(tag => (
                                <span key={tag} style={{
                                    fontSize: '10px', padding: '3px 8px', borderRadius: '100px',
                                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                                    fontWeight: 600,
                                }}>#{tag}</span>
                            ))}
                        </div>
                    )}
                    {selectedNode.url && (
                        <a href={selectedNode.url} target="_blank" rel="noopener noreferrer"
                            style={{
                                fontSize: '12px', fontWeight: 600, color: '#7c6dfa',
                                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                            Open link →
                        </a>
                    )}
                </div>
            )
        }

        if (selectedNode.group === 'category') {
            return (
                <div className="kg-tooltip">
                    <button className="kg-tooltip-close" onClick={() => setSelectedNode(null)}>
                        <X style={{ width: '14px', height: '14px' }} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: selectedNode.color }} />
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{selectedNode.name}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                        {categoryStats.find(c => c.name === selectedNode.name)?.count || 0} saves in this category
                    </p>
                </div>
            )
        }

        if (selectedNode.group === 'tag') {
            return (
                <div className="kg-tooltip">
                    <button className="kg-tooltip-close" onClick={() => setSelectedNode(null)}>
                        <X style={{ width: '14px', height: '14px' }} />
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selectedNode.name}</span>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                        Shared by {selectedNode.connectedSaves || 0} saves
                    </p>
                </div>
            )
        }

        return null
    }

    return (
        <div ref={containerRef} className="kg-container">
            <ForceGraph2D
                ref={graphRef}
                width={dimensions.w}
                height={dimensions.h}
                graphData={{ nodes, links }}
                /* ── Rendering ── */
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={(node, color, ctx) => {
                    const r = Math.sqrt(node.val) * 2 + 4
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                    ctx.fillStyle = color
                    ctx.fill()
                }}
                linkCanvasObject={paintLink}
                backgroundColor="transparent"
                /* ── Forces ── */
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.4}
                warmupTicks={120}
                cooldownTicks={300}
                cooldownTime={2000}
                d3Force="charge"
                d3ForceStrength={-120}
                onEngineStop={() => {
                    // Freeze all nodes in place after simulation stabilizes
                    if (graphRef.current) {
                        const gd = graphRef.current
                        nodes.forEach(node => {
                            node.fx = node.x
                            node.fy = node.y
                        })
                        gd.zoomToFit(400, 60)
                    }
                }}
                /* ── Interactions ── */
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onBackgroundClick={() => setSelectedNode(null)}
                enableNodeDrag={false}
                enableZoomInteraction={true}
                enablePanInteraction={true}
            />

            {/* ── Legend ── */}
            <div className="kg-legend">
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginBottom: '12px', letterSpacing: '-0.01em' }}>
                    Knowledge Graph
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categoryStats.map(cat => (
                        <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: cat.color, flexShrink: 0,
                            }} />
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', flex: 1 }}>{cat.name}</span>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>{cat.count}</span>
                        </div>
                    ))}
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Tags</span>
                    </div>
                </div>
            </div>

            {/* ── Zoom controls ── */}
            <div className="kg-controls">
                <button onClick={zoomIn} className="kg-control-btn" title="Zoom in">
                    <ZoomIn style={{ width: '16px', height: '16px' }} />
                </button>
                <button onClick={zoomOut} className="kg-control-btn" title="Zoom out">
                    <ZoomOut style={{ width: '16px', height: '16px' }} />
                </button>
                <button onClick={zoomFit} className="kg-control-btn" title="Zoom to fit">
                    <Maximize2 style={{ width: '16px', height: '16px' }} />
                </button>
            </div>

            {/* ── Tooltip ── */}
            {renderTooltip()}
        </div>
    )
}
