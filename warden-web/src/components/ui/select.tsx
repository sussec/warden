"use client"

import * as React from "react"

import { Select as KumoSelect } from "@cloudflare/kumo/components/select"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed shim for the former shadcn/Radix `Select`.
 *
 * Kumo ships a single compound `Select` (with `Select.Option`, `Select.Group`,
 * `Select.GroupLabel`, `Select.Separator`) that renders its own trigger,
 * value, popup and items internally. The rest of the app, however, uses the
 * split shadcn API (`Select` + `SelectTrigger` / `SelectValue` /
 * `SelectContent` / `SelectItem` / ...).
 *
 * To preserve that public API exactly, this file keeps all the old export
 * names but treats `SelectTrigger` / `SelectValue` / `SelectContent` as
 * declarative "config" components: they don't render markup themselves.
 * Instead the top-level `Select` walks its children to pull the trigger
 * `className`/`size`/`id`/`aria-label`, the `placeholder`, and the list of
 * options, then renders a single Kumo `<Select>` with `<Select.Option>`
 * children.
 */

// ---------------------------------------------------------------------------
// Size mapping: shadcn trigger sizes ("sm" | "default") -> Kumo sizes.
// ---------------------------------------------------------------------------
type ShadcnTriggerSize = "sm" | "default"
type KumoSize = "xs" | "sm" | "base" | "lg"

function mapSize(size: ShadcnTriggerSize | undefined): KumoSize {
  return size === "sm" ? "sm" : "base"
}

// ---------------------------------------------------------------------------
// Config collected from the declarative sub-components.
// ---------------------------------------------------------------------------
type TriggerConfig = {
  className?: string
  size?: ShadcnTriggerSize
  id?: string
  "aria-label"?: string
}

type ValueConfig = {
  placeholder?: string
}

type CollectedOption = {
  value: unknown
  children: React.ReactNode
  disabled?: boolean
  className?: string
  key?: React.Key | null
}

// ---------------------------------------------------------------------------
// Marker components. These never render on their own — the parent `Select`
// reads their props during the walk. We tag them so the walk can identify
// them even when wrapped.
// ---------------------------------------------------------------------------

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"button"> & {
  size?: ShadcnTriggerSize
}) {
  // Render nothing; the parent `Select` consumes `className`/`size`/`id`/
  // `aria-label` and the nested `SelectValue` for the placeholder.
  void className
  void size
  void props
  return <>{children}</>
}
SelectTrigger.displayName = "SelectTrigger"

function SelectValue({
  placeholder,
  ...props
}: React.ComponentProps<"span"> & { placeholder?: string }) {
  void placeholder
  void props
  return null
}
SelectValue.displayName = "SelectValue"

function SelectContent({
  children,
  ...props
}: React.ComponentProps<"div"> & {
  position?: string
  align?: string
}) {
  void props
  return <>{children}</>
}
SelectContent.displayName = "SelectContent"

function SelectItem({
  value,
  children,
  disabled,
  className,
  ...props
}: {
  value: unknown
  children?: React.ReactNode
  disabled?: boolean
  className?: string
} & Omit<React.ComponentProps<"div">, "children">) {
  void value
  void children
  void disabled
  void className
  void props
  return null
}
SelectItem.displayName = "SelectItem"

function SelectGroup({ children, ...props }: React.ComponentProps<"div">) {
  void props
  return <>{children}</>
}
SelectGroup.displayName = "SelectGroup"

function SelectLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  void props
  return (
    <KumoSelect.GroupLabel className={cn(className)}>
      {children}
    </KumoSelect.GroupLabel>
  )
}
SelectLabel.displayName = "SelectLabel"

function SelectSeparator({ className }: React.ComponentProps<"div">) {
  return <KumoSelect.Separator className={cn(className)} />
}
SelectSeparator.displayName = "SelectSeparator"

// Scroll buttons have no Kumo equivalent (Base UI manages scrolling
// internally). Keep them as no-op exports so consumers don't break.
function SelectScrollUpButton(props: React.ComponentProps<"div">) {
  void props
  return null
}
SelectScrollUpButton.displayName = "SelectScrollUpButton"

function SelectScrollDownButton(props: React.ComponentProps<"div">) {
  void props
  return null
}
SelectScrollDownButton.displayName = "SelectScrollDownButton"

// ---------------------------------------------------------------------------
// Child-walking helpers.
// ---------------------------------------------------------------------------

// Returns a plain boolean (NOT a type predicate) so that successive checks in
// `renderOptions` don't cumulatively narrow `child` down to `never`.
function isElementOfType(
  node: React.ReactNode,
  component: { displayName?: string }
): boolean {
  return (
    React.isValidElement(node) &&
    (node.type as { displayName?: string })?.displayName ===
      component.displayName
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<any>

function collectTrigger(children: React.ReactNode): {
  trigger: TriggerConfig
  value: ValueConfig
} {
  const trigger: TriggerConfig = {}
  const value: ValueConfig = {}

  React.Children.forEach(children, (child) => {
    if (isElementOfType(child, SelectTrigger)) {
      const props = (child as AnyElement).props as TriggerConfig & {
        children?: React.ReactNode
      }
      trigger.className = props.className
      trigger.size = props.size
      trigger.id = props.id
      trigger["aria-label"] = props["aria-label"]
      React.Children.forEach(props.children, (inner) => {
        if (isElementOfType(inner, SelectValue)) {
          value.placeholder = ((inner as AnyElement).props as ValueConfig)
            .placeholder
        }
      })
    }
  })

  return { trigger, value }
}

function renderOptions(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (rawChild) => {
    if (!React.isValidElement(rawChild)) return null
    const child = rawChild as AnyElement

    if (isElementOfType(child, SelectContent)) {
      return renderOptions(
        (child.props as { children?: React.ReactNode }).children
      )
    }

    if (isElementOfType(child, SelectGroup)) {
      return (
        <KumoSelect.Group
          className={(child.props as { className?: string }).className}
        >
          {renderOptions(
            (child.props as { children?: React.ReactNode }).children
          )}
        </KumoSelect.Group>
      )
    }

    if (isElementOfType(child, SelectLabel)) {
      return child
    }

    if (isElementOfType(child, SelectSeparator)) {
      return child
    }

    if (isElementOfType(child, SelectItem)) {
      const props = child.props as CollectedOption
      return (
        <KumoSelect.Option
          key={child.key}
          value={props.value}
          disabled={props.disabled}
          className={props.className}
        >
          {props.children}
        </KumoSelect.Option>
      )
    }

    // Fragments / arrays produced by `.map(...)` in consumers.
    if (child.type === React.Fragment) {
      return renderOptions(
        (child.props as { children?: React.ReactNode }).children
      )
    }

    return null
  })
}

// ---------------------------------------------------------------------------
// Top-level Select: renders the real Kumo Select.
// ---------------------------------------------------------------------------

// Mirror the shadcn/Radix `Select.Root` public surface: values are strings.
type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  name?: string
  children?: React.ReactNode
} & Omit<
  React.ComponentProps<typeof KumoSelect>,
  "value" | "defaultValue" | "onValueChange" | "children" | "size"
>

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SelectProps) {
  const { trigger, value: valueConfig } = React.useMemo(
    () => collectTrigger(children),
    [children]
  )
  const options = renderOptions(children)

  return (
    <KumoSelect
      value={value}
      defaultValue={defaultValue}
      onValueChange={
        onValueChange
          ? (next: unknown) => onValueChange(next as string)
          : undefined
      }
      size={mapSize(trigger.size)}
      className={trigger.className}
      placeholder={valueConfig.placeholder}
      id={trigger.id}
      aria-label={trigger["aria-label"]}
      {...props}
    >
      {options}
    </KumoSelect>
  )
}
Select.displayName = "Select"

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
