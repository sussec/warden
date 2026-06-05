"use client"

import * as React from "react"
import { Checkbox as KumoCheckbox } from "@cloudflare/kumo/components/checkbox"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed Checkbox shim.
 *
 * Preserves the previous shadcn/Radix public API: a single `Checkbox` export
 * that accepts `className`, `checked`, `onCheckedChange`, `aria-label`,
 * `disabled`, and forwards any extra DOM attributes (e.g. `onClick`) to the
 * underlying control. Kumo's `<Checkbox>` destructures its known props and
 * spreads the rest onto the Base UI checkbox root, so passthrough props work.
 *
 * Note: Radix exposed an internal Indicator/check icon; Kumo renders its own
 * check/indeterminate indicator, so no sub-parts are needed here.
 */
type KumoCheckboxProps = React.ComponentProps<typeof KumoCheckbox>

// Widen the type so consumers can keep passing DOM attributes (onClick, etc.)
// that Radix accepted and that Kumo forwards via its rest-prop spread.
type CheckboxProps = KumoCheckboxProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof KumoCheckboxProps>

function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <KumoCheckbox
      data-slot="checkbox"
      className={cn(className)}
      {...props}
    />
  )
}

export { Checkbox }
