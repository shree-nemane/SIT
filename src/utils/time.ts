/**
 * Friendly Relative Time Formatter
 * Requirement #3: Non-intrusive relative strings ("Just now", "5m ago", "2h ago", "Yesterday", "3d ago")
 * Does not require continuous timers or polling.
 */

export const formatRelativeTime = (isoString: string): string => {
  if (!isoString) return '';

  const timestamp = new Date(isoString).getTime();
  if (isNaN(timestamp)) return '';

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs <= 0 || diffSecs < 60) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    return new Date(isoString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  }
};

export default formatRelativeTime;
