'use client'

import { useMemo } from 'react'
import type { LiveHeatmapCell } from '@/types/live'

interface Props {
  cells: LiveHeatmapCell[]
  /** 버킷 축 길이 상한. 가장 최근 N개 버킷만 표시한다. */
  maxBuckets?: number
}

/**
 * error_subtype × 5초 버킷 히트맵.
 * 색 강도는 같은 표 안에서의 count 최댓값을 기준으로 정규화한다(상대 비교용).
 */
export default function ErrorHeatmap({ cells, maxBuckets = 24 }: Props) {
  const { subtypes, buckets, grid, maxCount } = useMemo(() => build(cells, maxBuckets), [
    cells,
    maxBuckets
  ])

  if (subtypes.length === 0 || buckets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
        집계된 오류가 아직 없습니다. 학생이 제출하면 실시간으로 표시됩니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium text-slate-500">
              오류 유형
            </th>
            {buckets.map(b => (
              <th
                key={b}
                className="whitespace-nowrap px-1 py-1 text-[10px] font-normal text-slate-400"
                title={b}
              >
                {formatBucketLabel(b)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subtypes.map(subtype => (
            <tr key={subtype}>
              <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-slate-700">
                {subtype}
              </td>
              {buckets.map(b => {
                const v = grid.get(`${subtype}|${b}`) ?? 0
                return (
                  <td
                    key={b}
                    className="h-6 w-6 rounded text-center text-[10px]"
                    style={{ backgroundColor: heatColor(v, maxCount), color: v > 0 ? '#fff' : '#cbd5e1' }}
                    title={`${subtype} · ${formatBucketLabel(b)} · ${v}건`}
                  >
                    {v > 0 ? v : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function build(cells: LiveHeatmapCell[], maxBuckets: number) {
  const subtypeOrder = new Map<string, number>()
  const bucketSet = new Set<string>()
  const grid = new Map<string, number>()
  let maxCount = 0

  for (const c of cells) {
    const key = `${c.error_subtype}|${c.bucket_start}`
    const prev = grid.get(key) ?? 0
    const next = prev + c.count
    grid.set(key, next)
    if (next > maxCount) maxCount = next
    bucketSet.add(c.bucket_start)
    subtypeOrder.set(c.error_subtype, (subtypeOrder.get(c.error_subtype) ?? 0) + c.count)
  }

  const subtypes = Array.from(subtypeOrder.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
  const buckets = Array.from(bucketSet).sort().slice(-maxBuckets)

  return { subtypes, buckets, grid, maxCount }
}

function heatColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return '#f8fafc'
  // indigo scale — 0 → 0.15, max → 0.9
  const intensity = 0.15 + (value / max) * 0.75
  return `rgba(79, 70, 229, ${intensity.toFixed(2)})`
}

function formatBucketLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
