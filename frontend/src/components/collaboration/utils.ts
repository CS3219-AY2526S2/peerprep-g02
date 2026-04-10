/**
 * Derive initials from a display name (e.g. "Alice" -> "AL", "Bob Smith" -> "BS").
 * Falls back to the first 2 characters of `fallbackId` when no name is available.
 */
export function getInitials(displayName: string | undefined, fallbackId: string): string {
    if (displayName) {
        const parts = displayName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].slice(0, 2).toUpperCase();
    }
    return fallbackId.slice(0, 2).toUpperCase();
}
