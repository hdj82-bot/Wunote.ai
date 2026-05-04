import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}))

import { dispatchText, dispatchJSON } from './dispatch'
import { ROUTER_OPUS, ROUTER_HAIKU } from './router'

function fakeTextMessage(text: string, model = 'claude-haiku-4-5') {
  return {
    model,
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }
  }
}

describe('dispatchText() — router-driven model + cache', () => {
  let origKey: string | undefined
  beforeEach(() => {
    mockCreate.mockReset()
    origKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-test'
  })
  afterEach(() => {
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = origKey
  })

  it('analyze task → Opus 4.7 + 5m cache', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('hello', ROUTER_OPUS))
    await dispatchText('analyze', { system: 'sys', messages: [{ role: 'user', content: 'hi' }] })
    const params = mockCreate.mock.calls[0][0]
    expect(params.model).toBe(ROUTER_OPUS)
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('professor-report task → Haiku 4.5 + 1h cache', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('hello', ROUTER_HAIKU))
    await dispatchText('professor-report', { system: 'sys', messages: [{ role: 'user', content: 'hi' }] })
    const params = mockCreate.mock.calls[0][0]
    expect(params.model).toBe(ROUTER_HAIKU)
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
  })

  it('rubric-evaluate task → Opus 4.7 + 1h cache', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('hello', ROUTER_OPUS))
    await dispatchText('rubric-evaluate', { system: 'sys', messages: [{ role: 'user', content: 'hi' }] })
    const params = mockCreate.mock.calls[0][0]
    expect(params.model).toBe(ROUTER_OPUS)
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
  })

  it('thinking 기본 = adaptive', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('x'))
    await dispatchText('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] })
    const params = mockCreate.mock.calls[0][0]
    expect(params.thinking).toEqual({ type: 'adaptive' })
  })

  it('thinking: false 명시 → 비활성화', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('x'))
    await dispatchText('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }], thinking: false })
    const params = mockCreate.mock.calls[0][0]
    expect(params.thinking).toBeUndefined()
  })

  it('text 블록만 추출하여 반환', async () => {
    mockCreate.mockResolvedValueOnce({
      model: 'claude-haiku-4-5',
      content: [
        { type: 'thinking', thinking: 'internal' },
        { type: 'text', text: 'visible' }
      ],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
    })
    const result = await dispatchText('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] })
    expect(result).toBe('visible')
  })
})

describe('dispatchJSON() — parse + retry', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'sk-test'
  })

  it('첫 시도 성공 → 1회 호출', async () => {
    mockCreate.mockResolvedValueOnce(fakeTextMessage('{"ok":true}'))
    const result = await dispatchJSON('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] }, JSON.parse)
    expect(result).toEqual({ ok: true })
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('첫 시도 실패 → 2회째 성공 → 결과 반환', async () => {
    mockCreate
      .mockResolvedValueOnce(fakeTextMessage('not json'))
      .mockResolvedValueOnce(fakeTextMessage('{"ok":true}'))
    const result = await dispatchJSON('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] }, JSON.parse)
    expect(result).toEqual({ ok: true })
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('연속 2회 실패 → 에러 throw', async () => {
    mockCreate
      .mockResolvedValueOnce(fakeTextMessage('bad1'))
      .mockResolvedValueOnce(fakeTextMessage('bad2'))
    await expect(
      dispatchJSON('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] }, JSON.parse)
    ).rejects.toThrow(/JSON 응답 파싱 2회 연속 실패/)
  })

  it('재시도 메시지에 assistant + user 추가 검증', async () => {
    mockCreate
      .mockResolvedValueOnce(fakeTextMessage('bad'))
      .mockResolvedValueOnce(fakeTextMessage('{"ok":true}'))
    await dispatchJSON('cardnews', { system: 's', messages: [{ role: 'user', content: 'h' }] }, JSON.parse)
    const retryParams = mockCreate.mock.calls[1][0]
    expect(retryParams.messages.length).toBe(3)
    expect(retryParams.messages[1].role).toBe('assistant')
    expect(retryParams.messages[2].role).toBe('user')
    expect(String(retryParams.messages[2].content)).toMatch(/유효한 JSON/)
  })
})
