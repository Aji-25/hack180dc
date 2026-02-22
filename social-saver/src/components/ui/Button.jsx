import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Button = React.forwardRef(({
    className,
    variant = 'primary',
    size = 'md',
    children,
    ...props
}, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50"

    const variants = {
        primary: "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-white shadow-[0_4px_16px_rgba(124,109,250,0.35),0_1px_0_rgba(255,255,255,0.1)_inset] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(124,109,250,0.45)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(124,109,250,0.3)]",
        secondary: "bg-white/5 text-[#9090b8] border border-white/5 hover:bg-white/10 hover:text-white hover:border-[var(--color-accent)]/30",
        ghost: "text-[#9090b8] hover:text-white hover:bg-white/5",
        outline: "border border-white/10 text-[#9090b8] hover:text-white hover:border-white/20 bg-transparent"
    }

    const sizes = {
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-10 px-4 py-2 text-sm gap-2",
        lg: "h-12 px-6 text-base gap-2.5",
        icon: "h-10 w-10 p-2"
    }

    return (
        <button
            type="button"
            ref={ref}
            className={twMerge(baseStyles, variants[variant] ?? variants.primary, sizes[size] ?? sizes.md, className)}
            {...props}
        >
            {children}
        </button>
    )
})

Button.displayName = "Button"
