"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import {
  Dialog as KumoDialog,
  DialogRoot as KumoDialogRoot,
  DialogTrigger as KumoDialogTrigger,
  DialogTitle as KumoDialogTitle,
  DialogDescription as KumoDialogDescription,
  DialogClose as KumoDialogClose,
} from "@cloudflare/kumo/components/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Kumo-backed shim for the previous shadcn/Radix Dialog.
 *
 * The public API (export names + props the codebase passes) is preserved so
 * consuming pages need no changes. Kumo's `Dialog` (the default panel export)
 * already renders its own portal + backdrop, so `DialogPortal`/`DialogOverlay`
 * are kept as thin compatibility wrappers.
 */

type AsChildProps = { asChild?: boolean }

/**
 * Base UI (which Kumo wraps) replaces Radix's `asChild` with a `render` prop.
 * Translate `asChild` + single child element into a `render` element so callers
 * that still pass `asChild` (e.g. `<DialogTrigger asChild>`) keep working.
 */
function withAsChild<P extends { children?: React.ReactNode }>(
  props: P & AsChildProps
): Omit<P, never> & { render?: React.ReactElement } {
  const { asChild, children, ...rest } = props as P &
    AsChildProps & { render?: React.ReactElement }

  if (asChild && React.isValidElement(children)) {
    return { ...(rest as P), render: children as React.ReactElement }
  }

  return { ...(rest as P), children } as P & { render?: React.ReactElement }
}

function Dialog({
  children,
  ...props
}: React.ComponentProps<typeof KumoDialogRoot> & {
  children?: React.ReactNode
}) {
  return (
    <KumoDialogRoot data-slot="dialog" {...props}>
      {children}
    </KumoDialogRoot>
  )
}

function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof KumoDialogTrigger> & AsChildProps) {
  return (
    <KumoDialogTrigger
      data-slot="dialog-trigger"
      {...withAsChild({ asChild, children, ...props })}
    />
  )
}

/**
 * Kumo's `Dialog` panel renders its own portal + backdrop. These wrappers exist
 * only to preserve the original export surface; `DialogContent` does not depend
 * on them.
 */
function DialogPortal({
  children,
}: React.ComponentProps<"div"> & { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof KumoDialogClose> & AsChildProps) {
  return (
    <KumoDialogClose
      data-slot="dialog-close"
      {...withAsChild({ asChild, children, ...props })}
    />
  )
}

/**
 * Kumo manages the backdrop internally, so the standalone overlay renders
 * nothing. Kept for API compatibility.
 */
function DialogOverlay(
  _props: React.ComponentProps<"div">
): React.ReactElement | null {
  return null
}

type KumoDialogSize = NonNullable<
  React.ComponentProps<typeof KumoDialog>["size"]
>

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  ...props
}: Omit<React.ComponentProps<typeof KumoDialog>, "children"> & {
  children?: React.ReactNode
  showCloseButton?: boolean
  size?: KumoDialogSize
}) {
  return (
    <KumoDialog
      data-slot="dialog-content"
      size={size}
      className={cn("relative", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <KumoDialogClose
          data-slot="dialog-close"
          className="absolute top-4 right-4 rounded-xs text-kumo-subtle opacity-70 transition-opacity hover:opacity-100 hover:text-kumo-default focus:outline-none focus-visible:ring-2 focus-visible:ring-kumo-hairline disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </KumoDialogClose>
      )}
    </KumoDialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center text-kumo-default sm:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof KumoDialogTitle>) {
  return (
    <KumoDialogTitle
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-none font-semibold text-kumo-default",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof KumoDialogDescription>) {
  return (
    <KumoDialogDescription
      data-slot="dialog-description"
      className={cn("text-sm text-kumo-subtle", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
