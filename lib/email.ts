// Resend 이메일 발송 — REST API 를 fetch 로 직접 호출. 외부 패키지 의존성 없음.
// Node 18+ 의 내장 fetch 를 사용하며 Next.js route runtime 은 'nodejs' 로 지정해야 한다.

import type { CardnewsRecord } from '@/types/cardnews'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  from?: string // 기본: RESEND_FROM_EMAIL 환경변수
  replyTo?: string
}

export interface SendEmailResult {
  id: string
}

export class EmailError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'EmailError'
    this.status = status
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new EmailError('RESEND_API_KEY 환경변수가 설정되지 않았습니다', 500)
  return key
}

function getDefaultFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'Wunote <noreply@wunote.ai>'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getApiKey()
  const body = {
    from: input.from ?? getDefaultFrom(),
    to: [input.to],
    subject: input.subject,
    html: input.html,
    reply_to: input.replyTo,
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new EmailError(`Resend ${res.status}: ${raw.slice(0, 500)}`, res.status)
  }

  try {
    const parsed = JSON.parse(raw) as { id?: string }
    return { id: parsed.id ?? '' }
  } catch {
    return { id: '' }
  }
}

// ============================================================
// 카드뉴스 HTML 템플릿 — 인라인 스타일 (메일 클라이언트 호환)
// ============================================================

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderBar(points: Array<{ name: string; value: number }>): string {
  if (points.length === 0) return '<p style="color:#64748b;font-size:13px;">오류가 기록되지 않았습니다 ✅</p>'
  const max = Math.max(...points.map((p) => p.value), 1)
  return points
    .map((p) => {
      const pct = Math.round((p.value / max) * 100)
      return `<div style="margin:6px 0;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#334155;">
          <span>${esc(p.name)}</span><span>${p.value}</span>
        </div>
        <div style="background:#e2e8f0;border-radius:4px;overflow:hidden;height:8px;">
          <div style="width:${pct}%;height:100%;background:#4f46e5;"></div>
        </div>
      </div>`
    })
    .join('')
}

export interface CardnewsEmailOptions {
  record: CardnewsRecord
  studentName: string | null
  appUrl: string // 예: https://wunote.ai/cardnews/<weekId>
}

export function renderCardnewsEmail({
  record,
  studentName,
  appUrl,
}: CardnewsEmailOptions): { subject: string; html: string } {
  const { card1, card2, card3, card4, goal_progress, week_start } = record
  const name = studentName?.trim() || '학습자'
  const subject = `[Wunote] ${week_start} 주간 카드뉴스 📬`

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px;">이번 주 학습 카드뉴스</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px;">${esc(name)} 님 · ${esc(week_start)} 주</p>

    <!-- Card 1 -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">① 이번 주 나의 오류</div>
      <div style="font-size:28px;font-weight:700;color:#0f172a;">${card1.total_errors}건</div>
      <div style="font-size:12px;color:#475569;margin-bottom:12px;">문법 ${card1.grammar_count} · 어휘 ${card1.vocab_count}</div>
      ${renderBar(card1.by_subtype)}
      <p style="font-size:13px;color:#334155;margin:12px 0 0;">${esc(card1.week_summary)}</p>
    </div>

    <!-- Card 2 -->
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="font-size:11px;color:#059669;margin-bottom:4px;">② 가장 많이 개선됨 🎉</div>
      <div style="font-size:16px;font-weight:700;color:#064e3b;">${esc(card2.headline)}</div>
      ${
        card2.improved_subtype
          ? `<div style="font-size:12px;color:#047857;margin-top:6px;">${esc(card2.improved_subtype)} · ${card2.previous_count} → ${card2.current_count} (-${card2.delta})</div>`
          : ''
      }
      <p style="font-size:13px;color:#065f46;margin:10px 0 0;">${esc(card2.positive_note)}</p>
    </div>

    <!-- Card 3 -->
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="font-size:11px;color:#c2410c;margin-bottom:4px;">③ 지금 당장 할 것 · 약 ${card3.estimated_minutes}분</div>
      <div style="font-size:16px;font-weight:700;color:#7c2d12;">${esc(card3.action_title)}</div>
      <p style="font-size:13px;color:#9a3412;margin:8px 0 12px;">${esc(card3.action_detail)}</p>
      <div style="font-size:11px;color:#9a3412;">목표 달성률 ${goal_progress.percent}%</div>
      <div style="background:#fed7aa;border-radius:4px;overflow:hidden;height:6px;margin-top:4px;">
        <div style="width:${goal_progress.percent}%;height:100%;background:#ea580c;"></div>
      </div>
    </div>

    <!-- Card 4 -->
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:16px;margin-bottom:20px;">
      <div style="font-size:11px;color:#1d4ed8;margin-bottom:4px;">④ 다음 주 학습 방향</div>
      <div style="font-size:16px;font-weight:700;color:#1e3a8a;">${
        card4.next_chapter_number != null ? `제${card4.next_chapter_number}장 · ` : ''
      }${esc(card4.next_chapter_title)}</div>
      <ul style="font-size:13px;color:#1e40af;margin:10px 0 0;padding-left:18px;">
        ${card4.preview_points.map((p) => `<li>${esc(p)}</li>`).join('')}
      </ul>
      ${
        card4.focus_grammar
          ? `<div style="font-size:11px;color:#1e3a8a;margin-top:10px;">담당 교수자 문법 포인트: ${esc(card4.focus_grammar)}</div>`
          : ''
      }
    </div>

    <p style="text-align:center;margin:0;">
      <a href="${esc(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">앱에서 자세히 보기</a>
    </p>
    <p style="font-size:10px;color:#94a3b8;text-align:center;margin:20px 0 0;">
      이메일 수신을 원하지 않으시면 Wunote 설정에서 알림을 끌 수 있습니다.
    </p>
  </div>
</body></html>`

  return { subject, html }
}
