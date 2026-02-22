import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bookmark, MessageCircle, Sparkles, ArrowRight, Zap,
    Search, Layers, BarChart3, Mic, Camera, Brain,
    ChevronRight, ExternalLink, Star, Check
} from 'lucide-react'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

const FEATURES = [
    {
        icon: MessageCircle,
        title: 'Save via WhatsApp',
        desc: 'Forward any link to our bot. Instagram reels, tweets, blogs — anything.',
        color: '#25D366',
        gradient: 'from-[#25D366]/20 to-[#25D366]/5'
    },
    {
        icon: Sparkles,
        title: 'AI Categorization',
        desc: 'GPT-4o auto-categorizes with tags, summaries, and action steps.',
        color: '#7c6dfa',
        gradient: 'from-[#7c6dfa]/20 to-[#7c6dfa]/5'
    },
    {
        icon: Search,
        title: 'Natural Language Search',
        desc: '"Show me chicken recipes from Instagram" — just ask.',
        color: '#1da1f2',
        gradient: 'from-[#1da1f2]/20 to-[#1da1f2]/5'
    },
    {
        icon: Mic,
        title: 'Voice Notes',
        desc: 'Send a voice memo. We transcribe and save your thoughts.',
        color: 'var(--color-accent)',
        gradient: 'from-[var(--color-accent)]/20 to-[var(--color-accent)]/5'
    },
    {
        icon: Camera,
        title: 'Image Recognition',
        desc: 'Snap a book cover or screenshot. AI extracts and saves the info.',
        color: 'var(--color-accent-2)',
        gradient: 'from-[var(--color-accent-2)]/20 to-[var(--color-accent-2)]/5'
    },
    {
        icon: Brain,
        title: 'Chat with Your Brain',
        desc: '"Draft a tweet from my fitness saves" — generate content from your library.',
        color: '#3dd68c',
        gradient: 'from-[#3dd68c]/20 to-[#3dd68c]/5'
    },
]

const STEPS = [
    {
        num: '01',
        title: 'Save our number',
        desc: 'Add the Social Saver bot on WhatsApp.',
        icon: MessageCircle,
        color: '#25D366'
    },
    {
        num: '02',
        title: 'Send anything',
        desc: 'Forward a link, voice note, or photo.',
        icon: Zap,
        color: '#fbbf24'
    },
    {
        num: '03',
        title: 'See it here',
        desc: 'Your AI-powered dashboard organizes everything.',
        icon: Layers,
        color: 'var(--color-accent)'
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
        <div className="min-h-screen bg-[#111110] text-[#eeeeec] font-sans selection:bg-[var(--color-accent)]/30">
            {/* ── Nav ── */}
            <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-[#111110]/80 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] shadow-lg shadow-[var(--color-accent)]/20">
                        <Bookmark className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-white">Social Saver</span>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="secondary" size="sm" className="hidden sm:flex shadow-[0_0_15px_rgba(255,255,255,0.05)]" onClick={() => window.open('https://github.com/ajitesh18/social-saver', '_blank')}>
                        View on GitHub <ExternalLink className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                {/* Background Gradients */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[var(--color-accent)]/20 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-[var(--color-accent-2)]/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[var(--color-accent)] mb-8"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-[var(--color-accent)] animate-pulse"></span>
                        Built for Hack180
                    </motion.div>

                    <motion.h1
                        className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        Never lose a link <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]">
                            again.
                        </span>
                    </motion.h1>

                    <motion.p
                        className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Forward any link via WhatsApp. AI categorizes, summarizes, and organizes your saves into a searchable second brain.
                    </motion.p>

                    <motion.div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <Button onClick={onEnterDashboard} size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-[0_0_30px_rgba(124,109,250,0.4)] hover:shadow-[0_0_50px_rgba(124,109,250,0.6)]">
                            Try the Dashboard <ArrowRight className="h-5 w-5" />
                        </Button>
                        <Button variant="secondary" size="lg" className="h-14 px-8 text-lg rounded-2xl bg-white/5 hover:bg-white/10 border-white/10" onClick={() => window.open('https://wa.me/14155238886?text=join%20step-camp', '_blank')}>
                            <MessageCircle className="h-5 w-5 text-[#25D366]" /> Open WhatsApp
                        </Button>
                    </motion.div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 border-t border-white/5 pt-12">
                        {STATS.map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <span className="text-3xl font-bold text-white mb-1">{s.value}</span>
                                <span className="text-sm font-medium text-white/40 uppercase tracking-widest">{s.label}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features Grid ── */}
            <section className="py-24 px-6 relative bg-[#0e0e1a]/50">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Everything you need to save smarter</h2>
                        <p className="text-white/50 text-lg max-w-2xl mx-auto">
                            More than a bookmark manager — it's your AI-powered second brain that proactively organizes for you.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                className={cn(
                                    "relative p-8 rounded-3xl border border-white/5 bg-[#13131f] overflow-hidden group hover:border-white/10 transition-colors",
                                    hovered === i && "border-white/20"
                                )}
                            >
                                <div
                                    className={cn(
                                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
                                        f.gradient
                                    )}
                                />

                                <div className="relative z-10">
                                    <div className="mb-6 inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner" style={{ color: f.color }}>
                                        <f.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                                    <p className="text-white/50 leading-relaxed">{f.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Three steps. That's it.</h2>
                        <p className="text-white/50 text-lg">No complex setups. Just WhatsApp and go.</p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 relative items-start">
                        {/* Connecting Line (Desktop) */}
                        <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-accent)]/30 to-transparent hidden md:block" />

                        {STEPS.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                                className="relative flex flex-col items-center text-center group"
                            >
                                <div className="w-24 h-24 rounded-full bg-[#080810] border border-[var(--color-accent)]/30 flex items-center justify-center relative z-10 mb-6 shadow-[0_0_20px_rgba(124,109,250,0.15)] group-hover:border-[var(--color-accent)] transition-colors duration-300">
                                    <step.icon className="h-10 w-10 text-[var(--color-accent)]" />
                                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm border-4 border-[#080810]">
                                        {step.num}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-white/50 max-w-[250px]">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="py-24 px-6 relative">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="max-w-4xl mx-auto rounded-[3rem] bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent-2)]/20 border border-white/10 p-12 md:p-20 text-center relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-[#0e0e1a]/80 backdrop-blur-xl -z-10" />

                    <Bookmark className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-8" />

                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                        Ready to save smarter?
                    </h2>
                    <p className="text-xl text-white/60 mb-10 max-w-xl mx-auto">
                        Stop losing links in chat history. Start building your personal knowledge base today.
                    </p>

                    <Button size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-xl hover:shadow-[0_0_50px_rgba(124,109,250,0.4)]" onClick={() => window.open('https://github.com/ajitesh18/social-saver', '_blank')}>
                        <Star className="h-5 w-5 mr-2" /> Star on GitHub
                    </Button>
                </motion.div>
            </section>

            {/* ── Footer ── */}
            <footer className="py-8 border-t border-white/5 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="h-6 w-6 rounded bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] flex items-center justify-center">
                        <Bookmark className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-white">Social Saver</span>
                </div>
                <p className="text-xs text-white/40">
                    Built with <span className="text-red-500">❤️</span> for Hack180
                </p>
            </footer>
        </div>
    )
}
