import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Card = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={twMerge(
            "rounded-2xl border border-white/5 bg-[var(--color-bg-raised)]/60 backdrop-blur-xl text-[#f0f0ff] transition-all duration-300 hover:border-[var(--color-accent)]/25 hover:bg-[var(--color-bg-hover)]/85 hover:shadow-[0_0_0_1px_rgba(124,109,250,0.05),0_12px_40px_rgba(0,0,0,0.3)] hover:-translate-y-[2px]",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={twMerge("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={twMerge(
            "text-lg font-semibold leading-none tracking-tight text-[#f0f0ff]",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={twMerge("text-sm text-[#9090b8]", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

export const CardContent = React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={twMerge("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={twMerge("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"
