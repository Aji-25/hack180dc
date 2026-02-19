import { useState, useEffect } from 'react'
import { Bookmark, MessageCircle, LayoutDashboard, ArrowRight, X } from 'lucide-react'
import { Button } from './ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

const STEPS = [
    {
        icon: MessageCircle,
        title: 'Save our WhatsApp number',
        desc: 'Add the Social Saver bot to your WhatsApp contacts and send it a message to get started.',
        color: '#25D366'
    },
    {
        icon: Bookmark,
        title: 'Send any link',
        desc: 'Forward an Instagram reel, tweet, blog post, or any URL. The AI will auto-categorize and summarize it.',
        color: 'var(--color-accent-2)'
    },
    {
        icon: LayoutDashboard,
        title: 'See it here',
        desc: 'Your saves appear on this dashboard in real-time. Search, filter, and organize your content library.',
        color: 'var(--color-accent)'
    },
]

export default function OnboardingOverlay() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const seen = localStorage.getItem('social-saver-onboarded')
        if (!seen) setVisible(true)
    }, [])

    const dismiss = () => {
        setVisible(false)
        localStorage.setItem('social-saver-onboarded', 'true')
    }

    if (!visible) return null

    return (
        <AnimatePresence>
            {visible && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={dismiss}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-bg-raised)] shadow-2xl shadow-[var(--color-accent)]/10"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Decorative background gradients */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent)]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-accent-2)]/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                        {/* Close Button */}
                        <button
                            onClick={dismiss}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors z-20"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="p-8 relative z-10">
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] shadow-lg shadow-[var(--color-accent)]/20 mb-4">
                                    <Bookmark className="w-6 h-6 text-white" strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Welcome to Social Saver</h2>
                                <p className="text-sm text-white/60">
                                    Your AI-powered bookmark manager via WhatsApp
                                </p>
                            </div>

                            {/* Steps */}
                            <div className="space-y-6 mb-8">
                                {STEPS.map((step, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-white/40">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <step.icon className="w-4 h-4" style={{ color: step.color }} />
                                                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                                            </div>
                                            <p className="text-xs text-white/60 leading-relaxed">
                                                {step.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <Button onClick={dismiss} className="w-full shadow-lg shadow-[var(--color-accent)]/20">
                                Get Started <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
