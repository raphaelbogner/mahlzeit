// Best-effort relative-time formatter for the admin lists.
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'))
  if (Number.isNaN(date.getTime())) return iso
  const now = Date.now()
  const diffSec = Math.round((now - date.getTime()) / 1000)
  if (diffSec < 60) return 'gerade eben'
  if (diffSec < 3600) return `vor ${Math.floor(diffSec / 60)} min`
  if (diffSec < 86400) return `vor ${Math.floor(diffSec / 3600)} h`
  if (diffSec < 86400 * 7) return `vor ${Math.floor(diffSec / 86400)} Tagen`
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'))
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
