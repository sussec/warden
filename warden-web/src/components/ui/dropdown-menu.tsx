"use client"

import * as React from "react"

import { DropdownMenu as KumoDropdownMenu } from "@cloudflare/kumo/components/dropdown"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed shim for the former shadcn/Radix dropdown-menu.
 *
 * Public API (export names + accepted props) is preserved so consuming pages
 * do not need to change. Internally everything renders Cloudflare Kumo's
 * `DropdownMenu` compound component (built on `@base-ui/react/menu`).
 *
 * Notable old -> new mappings handled here:
 * - `asChild` (Radix/Slot) -> Base UI `render={<child />}`
 * - Item `variant="destructive"` -> Kumo `variant="danger"`
 * - `DropdownMenuPortal` -> `DropdownMenu.Portal`
 */

type AsChildProps = {
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * Translate the Radix `asChild` convention to Base UI's `render` prop.
 * When `asChild` is set, the single child element is adopted by the Kumo
 * component via `render`, otherwise children are passed through normally.
 */
function resolveAsChild<P extends AsChildProps>({
  asChild,
  children,
  ...rest
}: P): Record<string, unknown> {
  if (asChild && React.isValidElement(children)) {
    return { ...rest, render: children as React.ReactElement }
  }
  return { ...rest, children }
}

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu>) {
  return <KumoDropdownMenu data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Portal>) {
  return <KumoDropdownMenu.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Trigger> & {
  asChild?: boolean
}) {
  return (
    <KumoDropdownMenu.Trigger
      data-slot="dropdown-menu-trigger"
      {...resolveAsChild({ asChild, children, ...props })}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Content>) {
  return (
    <KumoDropdownMenu.Content
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-(--available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border border-kumo-hairline bg-kumo-elevated p-1 text-kumo-default shadow-md",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Group>) {
  return <KumoDropdownMenu.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof KumoDropdownMenu.Item>, "variant"> & {
  inset?: boolean
  variant?: "default" | "destructive" | "danger"
  asChild?: boolean
}) {
  // Map the old shadcn `destructive` variant name onto Kumo's `danger`.
  const kumoVariant = variant === "destructive" ? "danger" : variant

  return (
    <KumoDropdownMenu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      inset={inset}
      variant={kumoVariant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...resolveAsChild({ asChild, children, ...props })}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.CheckboxItem> & {
  className?: string
}) {
  return (
    <KumoDropdownMenu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      {children}
    </KumoDropdownMenu.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.RadioGroup>) {
  return (
    <KumoDropdownMenu.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.RadioItem> & {
  className?: string
}) {
  return (
    <KumoDropdownMenu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </KumoDropdownMenu.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Label> & {
  inset?: boolean
}) {
  return (
    <KumoDropdownMenu.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium text-kumo-default data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Separator> & {
  className?: string
}) {
  return (
    <KumoDropdownMenu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-kumo-hairline", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-kumo-subtle",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.Sub>) {
  return <KumoDropdownMenu.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <KumoDropdownMenu.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      inset={inset}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 data-[popup-open]:bg-kumo-base [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </KumoDropdownMenu.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof KumoDropdownMenu.SubContent>) {
  return (
    <KumoDropdownMenu.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-kumo-hairline bg-kumo-elevated p-1 text-kumo-default shadow-lg",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
