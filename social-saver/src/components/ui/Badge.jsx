import React from 'react'
import { twMerge } from 'tailwind-merge'

// Defined at module scope — not recreated on every render
const variants = {
    default: "border-transparent bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25",
    secondary: "border-transparent bg-white/5 text-[#9090b8] hover:bg-white/10",
    outline: "text-[#9090b8] border-white/10 hover:text-[#f0f0ff] hover:border-white/20",
    fitness: "bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20 hover:bg-[#34d399]/20",
    coding: "bg-[#818cf8]/10 text-[#818cf8] border-[#818cf8]/20 hover:bg-[#818cf8]/20",
    food: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20 hover:bg-[#fbbf24]/20",
    travel: "bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/20 hover:bg-[#38bdf8]/20",
    design: "bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)] border-[var(--color-accent-2)]/20 hover:bg-[var(--color-accent-2)]/20",
    business: "bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/20 hover:bg-[#a78bfa]/20",
    improvement: "bg-[#2dd4bf]/10 text-[#2dd4bf] border-[#2dd4bf]/20 hover:bg-[#2dd4bf]/20",
}

export const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
    return (
        <span
            ref={ref}
            className={twMerge(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2",
                variants[variant] ?? variants.default,
                className
            )}
            {...props}
        />
    )
})
Badge.displayName = "Badge"
