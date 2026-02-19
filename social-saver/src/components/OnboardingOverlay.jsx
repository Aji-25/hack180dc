import { useState, useEffect } from 'react'
import { Bookmark, MessageCircle, LayoutDashboard, ArrowRight, X } from 'lucide-react'

const STEPS = [
    {
        icon: MessageCircle,
        title: 'Save our WhatsApp number',
        desc: 'Add the Social Saver bot to your WhatsApp contacts and send it a message to get started.',
    },
    {
        icon: Bookmark,
        title: 'Send any link',
        desc: 'Forward an Instagram reel, tweet, blog post, or any URL. The AI will auto-categorize and summarize it.',
    },
    {
        icon: LayoutDashboard,
        title: 'See it here',
        desc: 'Your saves appear on this dashboard in real-time. Search, filter, and organize your content library.',
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
        <div className="onboarding-overlay" onClick={dismiss}>
            <div className="onboarding-card" onClick={e => e.stopPropagation()}>
                {/* Close */}
                <button
                    onClick={dismiss}
                    className="absolute top-4 right-4 text-text-tertiary hover:text-text-secondary transition-colors"
                    style={{ position: 'absolute', top: 16, right: 16 }}
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Logo + title */}
                <div className="flex items-center justify-center gap-2.5 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ff8c42' }}>
                        <Bookmark className="w-5 h-5 text-black" strokeWidth={2.5} />
                    </div>
                </div>
                <h2 className="text-[18px] font-bold mb-1">Welcome to Social Saver</h2>
                <p className="text-[13px] text-text-tertiary mb-5">
                    Your AI-powered bookmark manager via WhatsApp
                </p>

                {/* Steps */}
                <div className="mb-5">
                    {STEPS.map((step, i) => (
                        <div key={i} className="onboarding-step">
                            <div className="onboarding-step-num">{i + 1}</div>
                            <div>
                                <div className="text-[13px] font-semibold mb-0.5 flex items-center gap-1.5">
                                    <step.icon className="w-3.5 h-3.5" style={{ color: '#ff8c42' }} />
                                    {step.title}
                                </div>
                                <p className="text-[12px] text-text-tertiary leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <button onClick={dismiss} className="btn btn-accent w-full justify-center">
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}
