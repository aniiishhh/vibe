/**
 * Vibe brand mark: party bunting. Three pennants hang from a string, and the big
 * centre pennant is the "V". Parties are the core of the product, and the side
 * flags stand for the people Vibe sits with. One component, so a future mascot
 * can replace the assistant avatar in one place.
 */
export function VibeMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg className={`vibe-mark${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="vibe-mark-string" d="M1.3 5.1Q12 8.9 22.7 5.1" fill="none" strokeWidth="1.3" strokeLinecap="round" />
      <path className="vibe-mark-flag vibe-mark-left" d="M2.5 5.6Q4.5 6.2 6.5 6.6L5.05 11.9Q4.5 13.1 3.95 11.9Z" />
      <path className="vibe-mark-flag vibe-mark-right" d="M17.5 6.6Q19.5 6.2 21.5 5.6L20.05 11.9Q19.5 13.1 18.95 11.9Z" />
      <path className="vibe-mark-flag vibe-mark-main" d="M7.3 6.75Q12 7.95 16.7 6.75L12.9 19.7Q12 21.3 11.1 19.7Z" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? ' brand-compact' : ''}`}>
      <VibeMark size={compact ? 28 : 26} className="brand-mark" />
      {!compact && <span className="brand-name">vibe</span>}
      <span className="sr-only">Vibe</span>
    </span>
  );
}

/** Avatar used for @Vibe replies. Swap the inner mark for the mascot later. */
export function VibeAvatar({ size = 30 }: { size?: number }) {
  return (
    <span className="vibe-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <VibeMark size={Math.round(size * 0.78)} />
    </span>
  );
}
