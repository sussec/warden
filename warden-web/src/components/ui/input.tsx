"use client"

import * as React from "react"
import { Input as KumoInput, type InputProps as KumoInputProps } from "@cloudflare/kumo/components/input"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed shim for the legacy shadcn `Input`.
 *
 * Preserves the original public API: a single `Input` export accepting every
 * native `<input>` prop the codebase already passes (`type`, `value`,
 * `onChange`, `placeholder`, `id`, `readOnly`, `disabled`, `className`, ...).
 * Rendering is delegated to `@cloudflare/kumo`'s `Input`, which is itself a
 * `forwardRef` over Base UI's input, so refs are forwarded transparently.
 */
const Input = React.forwardRef<HTMLInputElement, KumoInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <KumoInput
        ref={ref}
        data-slot="input"
        className={cn("w-full", className)}
        {...props}
      />
    )
  }
)

export { Input }
