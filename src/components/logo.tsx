import { cn } from "@/lib/utils";

/**
 * The family-tree brand mark. Rendered as a CSS mask of the source SVG filled
 * with the theme's primary color, so it adapts to light/dark (sepia) themes.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-primary", className)}
      style={{
        WebkitMaskImage: "url(/familytree_icon_black.svg)",
        maskImage: "url(/familytree_icon_black.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
