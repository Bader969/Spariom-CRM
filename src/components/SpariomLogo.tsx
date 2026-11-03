import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface SpariomLogoProps {
  /**
   * Layout variant:
   * - "full": Emblem + "Spariom" logotype + subtitle
   * - "emblem": Interlocking infinity emblem only
   * - "wordmark": "Spariom" logotype only
   * - "auth-hero": 100x100px frosted pedestal with emblem & ambient golden glow
   */
  variant?: "full" | "emblem" | "wordmark" | "auth-hero";
  /** Predefined size preset or custom numeric pixel width of the emblem */
  size?: "sm" | "md" | "lg" | "xl" | number;
  /** Whether sidebar is in collapsed rail mode */
  isRail?: boolean;
  /** Whether to render the "CRM & Operations" subtitle (defaults to true in full variant) */
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SpariomEmblemVector({
  width = 36,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const id = useId();
  const computedHeight = height ?? Math.round(width * 0.66);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 660"
      width={width}
      height={computedHeight}
      fill="none"
      role="img"
      aria-label="Spariom Emblem"
      className={cn("shrink-0 transition-transform duration-200", className)}
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dfa44e" />
          <stop offset="45%" stopColor="#d2953c" />
          <stop offset="100%" stopColor="#b07425" />
        </linearGradient>

        {/* Mask 1: Left loop mask. Cuts out top crossing where right link passes in front */}
        <mask
          id={`${id}-left-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1000"
          height="660"
        >
          <rect width="1000" height="660" fill="#ffffff" />
          <polygon points="415,200 475,140 595,260 535,320" fill="#000000" />
        </mask>

        {/* Mask 2: Right loop mask. Cuts out bottom crossing where left link passes in front */}
        <mask
          id={`${id}-right-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1000"
          height="660"
        >
          <rect width="1000" height="660" fill="#ffffff" />
          <polygon points="415,460 535,340 595,400 475,520" fill="#000000" />
        </mask>
      </defs>

      {/* Left Ring: Rotated rounded square, masked at top crossing */}
      <g mask={`url(#${id}-left-mask)`}>
        <rect
          x="-115"
          y="-115"
          width="230"
          height="230"
          rx="48"
          transform="translate(370, 330) rotate(45)"
          stroke={`url(#${id}-gold)`}
          strokeWidth="84"
          fill="none"
          strokeLinejoin="round"
        />
      </g>

      {/* Right Ring: Rotated rounded square, masked at bottom crossing */}
      <g mask={`url(#${id}-right-mask)`}>
        <rect
          x="-115"
          y="-115"
          width="230"
          height="230"
          rx="48"
          transform="translate(630, 330) rotate(45)"
          stroke={`url(#${id}-gold)`}
          strokeWidth="84"
          fill="none"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function SpariomLogo({
  variant = "full",
  size = "md",
  isRail = false,
  showSubtitle = true,
  className,
  onClick,
}: SpariomLogoProps) {
  // Resolve emblem size
  let emblemWidth = 36;
  if (typeof size === "number") {
    emblemWidth = size;
  } else if (size === "sm") {
    emblemWidth = 28;
  } else if (size === "md") {
    emblemWidth = 36;
  } else if (size === "lg") {
    emblemWidth = 48;
  } else if (size === "xl") {
    emblemWidth = 64;
  }

  // Auth Hero Pedestal (100px pedestal with ambient glow)
  if (variant === "auth-hero") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-4 cursor-default select-none",
          className,
        )}
      >
        <div
          className="w-[100px] h-[100px] rounded-[24px] frosted-glass flex items-center justify-center p-4 relative"
          style={{
            boxShadow:
              "0 0 60px rgba(210, 149, 60, 0.25), 0 0 20px rgba(210, 149, 60, 0.15), inset 0 1px 0 var(--rim), inset 0 0 0 1px var(--rim-low)",
          }}
        >
          <SpariomEmblemVector width={64} />
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-2xl font-bold tracking-tight text-foreground font-sans">
            Spariom
          </span>
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/80 mt-0.5">
            CRM & Operations
          </span>
        </div>
      </div>
    );
  }

  // Emblem only
  if (variant === "emblem") {
    return (
      <div onClick={onClick} className={cn("inline-flex items-center justify-center", className)}>
        <SpariomEmblemVector width={emblemWidth} />
      </div>
    );
  }

  // Wordmark only
  if (variant === "wordmark") {
    return (
      <div onClick={onClick} className={cn("inline-flex flex-col leading-none", className)}>
        <span className="text-lg font-bold tracking-tight text-foreground font-sans">Spariom</span>
        {showSubtitle && (
          <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/75 mt-0.5">
            CRM & Operations
          </span>
        )}
      </div>
    );
  }

  // Full variant (emblem + logotype + subtitle) with rail mode support
  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-3 transition-all duration-200 select-none",
        isRail ? "justify-center w-full" : "",
        className,
      )}
    >
      <SpariomEmblemVector width={emblemWidth} />

      {!isRail && (
        <div className="flex flex-col min-w-0 transition-opacity duration-200">
          <span className="text-[17px] font-bold tracking-tight text-foreground font-sans leading-tight truncate">
            Spariom
          </span>
          {showSubtitle && (
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/75 leading-none mt-0.5 truncate">
              CRM & Operations
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default SpariomLogo;
