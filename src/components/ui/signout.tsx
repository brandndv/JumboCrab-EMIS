"use client";

import React, { ElementType, ComponentPropsWithoutRef, forwardRef } from "react";
import { signOut } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// Define base props that don't conflict with HTML attributes
interface BaseSignOutButtonProps {
  /** The element or component to render as */
  as?: ElementType;
  /** Additional class names */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
  /** Show the logout icon */
  showIcon?: boolean;
  /** Class name for the icon */
  iconClassName?: string;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Remove all default styling */
  unstyled?: boolean;
}

// Create a type that merges base props with the props of the rendered element
type SignOutButtonProps<T extends ElementType = 'button'> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof BaseSignOutButtonProps | 'as' | 'onClick'> & 
  BaseSignOutButtonProps;

// Create a polymorphic component with forwardRef
const SignOutButton = forwardRef(function SignOutButton<T extends ElementType = 'button'>(
  {
    as: Tag = 'button' as T,
    className = "",
    children,
    showIcon = true,
    iconClassName = "h-4 w-4",
    onClick,
    unstyled = false,
    ...props
  }: SignOutButtonProps<T>,
  ref: React.ForwardedRef<HTMLElement>
) {
  const router = useRouter();

  const handleSignOut = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }
    
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Cast to any to avoid TypeScript errors with polymorphic components
  const TagComponent = Tag as any;

  const baseClasses = unstyled 
    ? className 
    : cn("flex items-center gap-2 cursor-pointer", className);

  return (
    <TagComponent
      ref={ref}
      onClick={handleSignOut}
      className={baseClasses}
      {...props}
    >
      {!unstyled && showIcon && <LogOut className={cn("shrink-0", iconClassName)} />}
      {(!unstyled && !children) ? "Sign Out" : children}
    </TagComponent>
  );
}) as <T extends ElementType = 'button'>(
  props: SignOutButtonProps<T> & { ref?: React.ForwardedRef<HTMLElement> }
) => React.ReactElement;

// Set display name for debugging
Object.assign(SignOutButton, { displayName: 'SignOutButton' });

export { SignOutButton };
export type { SignOutButtonProps };
