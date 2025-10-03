import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500/50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800",
        soft:
          "bg-gradient-to-br from-blue-50 to-blue-100/80 text-blue-700 hover:from-blue-100 hover:to-blue-200/80 dark:from-blue-950/40 dark:to-blue-900/30 dark:text-blue-300 dark:hover:from-blue-900/50 dark:hover:to-blue-800/40",
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800",
        outline:
          "border border-gray-200/80 bg-white/50 hover:bg-gray-50 hover:border-gray-300/80 dark:bg-gray-900/30 dark:border-gray-700/60 dark:hover:bg-gray-800/40 dark:hover:border-gray-600/70",
        secondary:
          "bg-gradient-to-b from-gray-100 to-gray-200/80 text-gray-700 hover:from-gray-200 hover:to-gray-300/80 dark:from-gray-800 dark:to-gray-900/80 dark:text-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800",
        ghost:
          "hover:bg-gray-100/80 hover:text-gray-900 dark:hover:bg-gray-800/60 dark:hover:text-gray-100",
        link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-4 text-base",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
