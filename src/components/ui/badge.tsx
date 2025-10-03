import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border-blue-300/50 dark:border-blue-600/50 bg-gradient-to-r from-blue-500 to-indigo-500 text-white [a&]:hover:from-blue-600 [a&]:hover:to-indigo-600 [a&]:hover:shadow-md",
        secondary:
          "border-gray-200/60 dark:border-gray-700/50 bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 dark:from-gray-800 dark:to-slate-800 dark:text-gray-300 [a&]:hover:from-gray-200 [a&]:hover:to-slate-200 dark:[a&]:hover:from-gray-700 dark:[a&]:hover:to-slate-700",
        destructive:
          "border-red-300/50 dark:border-red-600/50 bg-gradient-to-r from-red-500 to-rose-500 text-white [a&]:hover:from-red-600 [a&]:hover:to-rose-600 [a&]:hover:shadow-md focus-visible:ring-red-500/20 dark:focus-visible:ring-red-500/40",
        outline:
          "text-gray-700 dark:text-gray-300 border-gray-300/60 dark:border-gray-600/50 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm [a&]:hover:bg-gray-50 dark:[a&]:hover:bg-gray-800/60 [a&]:hover:border-gray-400/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
