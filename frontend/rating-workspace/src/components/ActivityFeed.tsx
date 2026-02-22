import { useState, useEffect } from 'react'
import { Loader2, Activity } from 'lucide-react'
import { activityApi, type ActivityEntry } from '../api/activity'
import { formatDate } from '../lib/utils'

// ── Action colour + label ─────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { dot: string; label: string }> = {
  created: { dot: 'bg-green-400', label: 'Created' },
  updated: { dot: 'bg-blue-400', label: 'Updated' },
  deleted: { dot: 'bg-red-400', label: 'Deleted' },
  generated: { dot: 'bg-purple-400', label: 'Generated' },
  evaluated: { dot: 'bg-orange-400', label: 'Evaluated' },
}

const ENTITY_LABELS: Record<string, string> = {
  product_line: 'Product',
  mapping: 'Mapping',
  rule: 'Rule',
  scope: 'Scope',
  orchestrator: 'Orchestrator',
}

function entryDescription(entry: ActivityEntry): string {
  const entity = ENTITY_LABELS[entry.entityType] ?? entry.entityType
  const action = entry.action

  if (action === 'created') return `${entity} created`
  if (action === 'deleted') return `${entity} deleted`
  if (action === 'updated') {
    const changes = entry.details?.changes as Record<string, unknown> | undefined
    if (changes) {
      const keys = Object.keys(changes)
      if (keys.length === 1) return `${entity} ${keys[0]} updated`
      if (keys.length === 2) return `${entity} ${keys.join(' & ')} updated`
      return `${entity} updated (${keys.length} fields)`
    }
    return `${entity} updated`
  }
  return `${entity} ${action}`
}

// ── ActivityFeed ──────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  productCode: string
}

export function ActivityFeed({ productCode }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    activityApi
      .list(productCode)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [productCode])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="py-6 text-center">
        <Activity className="w-6 h-6 text-gray-200 mx-auto mb-1.5" />
        <p className="text-xs text-gray-400">No activity yet</p>
      </div>
    )
  }

  return (
    <ol className="relative border-l border-gray-100 ml-2 space-y-0">
      {entries.map((entry) => {
        const style = ACTION_STYLES[entry.action] ?? { dot: 'bg-gray-300', label: entry.action }
        return (
          <li key={entry.id} className="ml-4 pb-4">
            {/* Timeline dot */}
            <span
              className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${style.dot}`}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-800">{entryDescription(entry)}</p>
                {entry.actor && entry.actor !== 'system' && (
                  <p className="text-[10px] text-gray-400 mt-0.5">by {entry.actor}</p>
                )}
              </div>
              <time className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
                {formatDate(entry.createdAt)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
