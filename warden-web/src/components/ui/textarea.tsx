"use client"

import * as React from "react"

import { InputArea } from "@cloudflare/kumo/components/input"

import { cn } from "@/lib/utils"

type KumoInputAreaProps = React.ComponentProps<typeof InputArea>

/**
 * Textarea — Kumo-backed shim.
 *
 * Renders Cloudflare Kumo's `InputArea` internally while preserving the
 * original shadcn `Textarea` public API: it accepts `className` plus every
 * native `<textarea>` attribute (value, onChange, placeholder, rows, disabled,
 * id, etc.), and additionally surfaces Kumo's `variant`, `size`, and
 * `onValueChange` props.
 */
function Textarea({ className, ...props }: KumoInputAreaProps) {
  return (
    <InputArea
      data-slot="textarea"
      className={cn(className)}
      {...props}
    />
  )
}

export { Textarea }
