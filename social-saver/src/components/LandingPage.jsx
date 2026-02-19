import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bookmark, MessageCircle, Sparkles, ArrowRight, Zap,
    Search, Layers, BarChart3, Mic, Camera, Brain,
    ChevronRight, ExternalLink, Star
} from 'lucide-react'

const FEATURES = [
    {
        icon: MessageCircle,
        title: 'Save via WhatsApp',
        desc: 'Forward any link to our bot. Instagram reels, tweets, blogs — anything.',
        color: '#25D366',
    },
    {
        icon: Sparkles,
        title: 'AI Categorization',
        desc: 'GPT-4o auto-categorizes with tags, summaries, and action steps.',
        color: '#ff8c42',
    },
    {
        icon: Search,
        title: 'Natural Language Search',
        desc: '"Show me chicken recipes from Instagram" — just ask.',
        color: '#1da1f2',
    },
    {
        icon: Mic,
        title: 'Voice Notes',
        desc: 'Send a voice memo. We transcribe and save your thoughts.',
        color: '#a78bfa',
    },
    {
        icon: Camera,
        title: 'Image Recognition',
        desc: 'Snap a book cover or screenshot. AI extracts and saves the info.',
        color: '#f472b6',
    },
    {
        icon: Brain,
        title: 'Chat with Your Brain',
        desc: '"Draft a tweet from my fitness saves" — generate content from your library.',
        color: '#3dd68c',
    },
]

const STEPS = [
    {
        num: '01',
        title: 'Save our number',
        desc: 'Add the Social Saver bot on WhatsApp.',
        icon: MessageCircle,
    },
    {
        num: '02',
        title: 'Send anything',
        desc: 'Forward a link, voice note, or photo.',
        icon: Zap,
    },
    {
        num: '03',
        title: 'See it here',
        desc: 'Your AI-powered dashboard organizes everything.',
        icon: Layers,
    },
]

const STATS = [
    { value: '8+', label: 'AI Categories' },
    { value: '<2s', label: 'Save Time' },
    { value: '∞', label: 'Links Saved' },
    { value: '24/7', label: 'Always On' },
]

export default function LandingPage({ onEnterDashboard }) {
    const [hovered, setHovered] = useState(null)

    return (
        <div className="landing-page">
            {/* ── Nav ── */}
            <nav className="landing-nav">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ff8c42' }}>
                        <Bookmark className="w-4 h-4 text-black" strokeWidth={2.5} />
                    </div>
                    <span className="text-[15px] font-bold tracking-tight">Social Saver</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onEnterDashboard} className="btn btn-ghost text-[12px]">
                        Try Demo
                        <ArrowRight className="w-3 h-3" />
                    </button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <motion.section
                className="landing-hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <motion.div
                    className="landing-badge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <Star className="w-3 h-3" style={{ color: '#ff8c42' }} />
                    <span>Built for Hack180</span>
                </motion.div>

                <h1 className="landing-title">
                    Never lose a link
                    <br />
                    <span className="landing-title-accent">again.</span>
                </h1>

                <p className="landing-subtitle">
                    Forward any link via WhatsApp. AI categorizes, summarizes, and
                    organizes your saves into a searchable dashboard.
                </p>

                <div className="landing-cta-row">
                    <button onClick={onEnterDashboard} className="landing-cta-primary">
                        <Bookmark className="w-4 h-4" />
                        Try the Dashboard
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <a
                        href="https://wa.me/14155238886?text=join%20social-saver"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="landing-cta-secondary"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Open WhatsApp
                        <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                </div>

                {/* Stats */}
                <div className="landing-stats">
                    {STATS.map((s, i) => (
                        <motion.div
                            key={i}
                            className="landing-stat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                        >
                            <span className="landing-stat-value">{s.value}</span>
                            <span className="landing-stat-label">{s.label}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

            {/* ── Features Grid ── */}
            <section className="landing-section">
                <motion.div
                    className="landing-section-header"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                >
                    <span className="landing-section-tag">Features</span>
                    <h2 className="landing-section-title">Everything you need to save smarter</h2>
                    <p className="landing-section-desc">
                        More than a bookmark manager — it's your AI-powered second brain.
                    </p>
                </motion.div>

                <div className="landing-features-grid">
                    {FEATURES.map((f, i) => (
                        <motion.div
                            key={i}
                            className="landing-feature-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <div
                                className="landing-feature-icon"
                                style={{
                                    background: `${f.color}15`,
                                    color: f.color,
                                }}
                            >
                                <f.icon className="w-5 h-5" />
                            </div>
                            <h3 className="landing-feature-title">{f.title}</h3>
                            <p className="landing-feature-desc">{f.desc}</p>
                            {hovered === i && (
                                <motion.div
                                    className="landing-feature-glow"
                                    layoutId="glow"
                                    style={{ background: `${f.color}08` }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="landing-section">
                <motion.div
                    className="landing-section-header"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                >
                    <span className="landing-section-tag">How it works</span>
                    <h2 className="landing-section-title">Three steps. That's it.</h2>
                </motion.div>

                <div className="landing-steps">
                    {STEPS.map((step, i) => (
                        <motion.div
                            key={i}
                            className="landing-step"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15 }}
                        >
                            <div className="landing-step-num">{step.num}</div>
                            <div className="landing-step-content">
                                <div className="flex items-center gap-2">
                                    <step.icon className="w-4 h-4" style={{ color: '#ff8c42' }} />
                                    <h3 className="text-[15px] font-semibold">{step.title}</h3>
                                </div>
                                <p className="text-[13px] text-text-tertiary mt-1">{step.desc}</p>
                            </div>
                            {i < STEPS.length - 1 && (
                                <ChevronRight className="w-4 h-4 text-text-tertiary hidden md:block" />
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="landing-section">
                <motion.div
                    className="landing-final-cta"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                >
                    <Bookmark style={{ width: '36px', height: '36px', color: '#ff8c42', marginBottom: '16px' }} />
                    <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', marginBottom: '10px' }}>Ready to save smarter?</h2>
                    <p style={{ fontSize: '15px', color: 'var(--color-text-tertiary)', marginBottom: '28px', maxWidth: '420px', lineHeight: 1.6 }}>
                        Stop losing links in chat history. Start building your personal knowledge base.
                    </p>
                    <button onClick={onEnterDashboard} className="landing-cta-primary">
                        <Zap className="w-4 h-4" />
                        Launch Dashboard
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#ff8c42' }}>
                        <Bookmark className="w-2.5 h-2.5 text-black" strokeWidth={2.5} />
                    </div>
                    <span className="text-[12px] font-semibold">Social Saver</span>
                </div>
                <span className="text-[11px] text-text-tertiary">
                    Built with ❤️ for Hack180
                </span>
            </footer>
        </div>
    )
}
