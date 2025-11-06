"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { useId } from "react"

function Collapsible({
  'data-collapsible-id': collapsibleId,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root> & {
  'data-collapsible-id'?: string
}) {
  const id = useId()
  const stableId = collapsibleId || `collapsible-${id}`
  
  return (
    <CollapsiblePrimitive.Root 
      data-slot="collapsible" 
      data-collapsible-id={stableId}
      {...props}
    />
  )
}

function CollapsibleTrigger({
  'data-collapsible-id': collapsibleId,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger> & {
  'data-collapsible-id'?: string
}) {
  // Get the collapsible ID from props or generate a fallback
  const id = useId()
  const stableId = collapsibleId || `collapsible-trigger-${id}`
  
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      data-collapsible-id={stableId}
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
