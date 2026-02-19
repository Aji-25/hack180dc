import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        <input
            type={type}
            className={twMerge(
                "flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text)] ring-offset-[#080810] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#5a5a80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Input.displayName = "Input"
