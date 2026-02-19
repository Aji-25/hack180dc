import { useMemo, useState, useEffect, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

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

export default function KnowledgeGraph({ saves }) {
    const containerRef = useRef(null)
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 })

    useEffect(() => {
        function resize() {
            if (containerRef.current) {
                setDimensions({
                    w: containerRef.current.clientWidth,
                    h: containerRef.current.clientHeight
                })
            }
        }
        resize()
        window.addEventListener('resize', resize)
        return () => window.removeEventListener('resize', resize)
    }, [])

    const { nodes, links } = useMemo(() => {
        const nodes = []
        const links = []
        const tagSet = new Set()
        const nodeSet = new Set()

        saves.forEach(save => {
            if (!nodeSet.has(save.id)) {
                nodes.push({
                    id: save.id,
                    name: save.title || save.summary || 'Untitled',
                    val: 8,
                    group: 'save',
                    color: CAT_COLORS[save.category] || '#9ca3af',
                    url: save.url
                })
                nodeSet.add(save.id)
            }

            if (save.tags) {
                save.tags.forEach(tag => {
                    const tagId = `tag-${tag}`
                    if (!nodeSet.has(tagId)) {
                        nodes.push({
                            id: tagId,
                            name: `#${tag}`,
                            val: 4,
                            group: 'tag',
                            color: '#4b5563'
                        })
                        nodeSet.add(tagId)
                    }
                    links.push({
                        source: save.id,
                        target: tagId
                    })
                })
            }
        })
        return { nodes, links }
    }, [saves])

    return (
        <div ref={containerRef} className="w-full h-[600px] mt-4 bg-[#111110] border border-[#2e2e2c] rounded-xl overflow-hidden relative">
            <ForceGraph2D
                width={dimensions.w}
                height={dimensions.h}
                graphData={{ nodes, links }}
                nodeLabel="name"
                nodeColor="color"
                nodeRelSize={4}
                linkColor={() => '#ffffff20'}
                backgroundColor="#111110"
                onNodeClick={node => {
                    if (node.url) window.open(node.url, '_blank')
                }}
            />

            <div className="absolute top-4 left-4 bg-[#191918]/90 backdrop-blur p-3 rounded-lg border border-[#2e2e2c] text-[12px] text-[#eeeeec]">
                <div className="font-bold mb-2">Knowledge Graph</div>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3dd68c]"></span>
                        <span>Links</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4b5563]"></span>
                        <span>Tags</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
