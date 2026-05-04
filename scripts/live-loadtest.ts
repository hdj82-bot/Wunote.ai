// 실시간 모드 부하 테스트 — Node 단독 실행 헤드리스 시뮬레이터.
// 사용법:
//   tsx scripts/live-loadtest.ts \
//     --class=<classId> \
//     --students=50 \
//     --duration=120 \
//     --interval=1000
//
// 동작:
//   1) student=50명 분 supabase realtime broadcast 클라이언트를 띄운다(읽기 X, 발행만).
//   2) 각 학생이 1초 debounce 로 random 길이(40~400자) 텍스트를 publish.
//   3) 별도 1명을 "교수자 옵저버" 로 띄워 incoming typing payload 수신 지연(p50/p95/p99) 측정.
//   4) duration 초 후 통계 요약 출력 — sent/received/dropped, latency 분위수, error 코드 별 카운트.
//
// 전제:
//   - .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 사용.
//   - 학생 인증 없이 anon 으로 broadcast 채널만 사용 (Supabase 의 broadcast 는 anon 허용).
//   - Realtime 채널 이름은 lib/live-broadcast.ts 와 동일: live-typing:<classId>

import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

interface CliArgs {
  classId: string
  students: number
  duration: number
  interval: number
}

function parseArgs(argv: string[]): CliArgs {
  const get = (name: string, fallback: string): string => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : fallback
  }
  const args: CliArgs = {
    classId: get('class', ''),
    students: Number(get('students', '50')),
    duration: Number(get('duration', '120')),
    interval: Number(get('interval', '1000'))
  }
  if (!args.classId) {
    console.error('--class=<classId> required')
    process.exit(2)
  }
  return args
}

interface Stats {
  sent: number
  received: number
  errors: Map<string, number>
  /** ts (ISO) 단위 latency 샘플(ms). */
  latencies: number[]
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[idx]
}

function randomText(): string {
  const len = 40 + Math.floor(Math.random() * 360)
  // 한글·중문 혼용 더미 텍스트.
  const charset =
    '가나다라마바사아자차카타파하我去学校了他们都在世界很大今天天气好不好你吃饭了吗'
  let s = ''
  for (let i = 0; i < len; i++) {
    s += charset[Math.floor(Math.random() * charset.length)]
  }
  return s
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되어야 합니다')
    process.exit(2)
  }

  const channelName = `live-typing:${args.classId}`
  const stats: Stats = { sent: 0, received: 0, errors: new Map(), latencies: [] }

  console.log(
    `[loadtest] class=${args.classId} students=${args.students} duration=${args.duration}s interval=${args.interval}ms`
  )

  // 옵저버
  const observerClient = createClient(url, anon, { auth: { persistSession: false } })
  const observer: RealtimeChannel = observerClient
    .channel(channelName, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      stats.received += 1
      const p = payload as { ts?: string } | undefined
      if (p?.ts) {
        const lag = Date.now() - new Date(p.ts).getTime()
        if (Number.isFinite(lag) && lag >= 0 && lag < 60000) stats.latencies.push(lag)
      }
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        const cur = stats.errors.get(`observer:${status}`) ?? 0
        stats.errors.set(`observer:${status}`, cur + 1)
      }
    })

  // 학생 N명
  const students = await Promise.all(
    Array.from({ length: args.students }, async (_, i) => {
      const c = createClient(url, anon, { auth: { persistSession: false } })
      const ch = c
        .channel(channelName, { config: { broadcast: { self: false, ack: false } } })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            const cur = stats.errors.get(`student:${status}`) ?? 0
            stats.errors.set(`student:${status}`, cur + 1)
          }
        })
      // 채널 SUBSCRIBED 대기 (최대 5초).
      await new Promise<void>((resolve) => {
        const start = Date.now()
        const id = setInterval(() => {
          if (ch.state === 'joined' || Date.now() - start > 5000) {
            clearInterval(id)
            resolve()
          }
        }, 50)
      })
      return { client: c, channel: ch, idx: i }
    })
  )

  const start = Date.now()
  const stopAt = start + args.duration * 1000

  const intervals: NodeJS.Timeout[] = []
  for (const s of students) {
    const t = setInterval(() => {
      void s.channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          student_id: `loadtest-${s.idx}`,
          name: `학생${s.idx + 1}`,
          text: randomText(),
          ts: new Date().toISOString()
        }
      })
      stats.sent += 1
    }, args.interval + Math.floor(Math.random() * 200))
    intervals.push(t)
  }

  // 진행 표시 5초마다.
  const ticker = setInterval(() => {
    const elapsed = Math.round((Date.now() - start) / 1000)
    console.log(
      `[loadtest] +${elapsed}s sent=${stats.sent} received=${stats.received} errors=${[...stats.errors.entries()].map(([k, v]) => `${k}=${v}`).join(',')}`
    )
  }, 5000)

  await new Promise<void>((resolve) => setTimeout(resolve, stopAt - Date.now()))

  for (const t of intervals) clearInterval(t)
  clearInterval(ticker)

  // 정리.
  await Promise.all(students.map((s) => s.client.removeChannel(s.channel)))
  await observerClient.removeChannel(observer)

  // 통계.
  const sorted = [...stats.latencies].sort((a, b) => a - b)
  const totalSent = stats.sent
  const totalRecv = stats.received
  const dropRate =
    totalSent > 0 ? Math.round((1 - totalRecv / totalSent) * 10000) / 100 : 0
  console.log('\n=== loadtest summary ===')
  console.log(`students:        ${args.students}`)
  console.log(`duration:        ${args.duration}s`)
  console.log(`broadcasts sent: ${totalSent}`)
  console.log(`broadcasts recv: ${totalRecv} (observer)`)
  console.log(`drop rate:       ${dropRate}%`)
  console.log(`latency p50:     ${quantile(sorted, 0.5)} ms`)
  console.log(`latency p95:     ${quantile(sorted, 0.95)} ms`)
  console.log(`latency p99:     ${quantile(sorted, 0.99)} ms`)
  if (stats.errors.size > 0) {
    console.log('errors:')
    for (const [k, v] of stats.errors) console.log(`  ${k}: ${v}`)
  } else {
    console.log('errors:          none')
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('[loadtest] fatal', e)
  process.exit(1)
})
