'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type {
  PronunciationLanguage,
  PronunciationAnalyzeResponse,
  PronunciationError,
} from '@/types/pronunciation'

const SAMPLE_TEXTS: Record<PronunciationLanguage, { title: string; text: string }[]> = {
  'en-US': [
    {
      title: 'Daily Greeting',
      text: 'Good morning. How are you doing today? I hope you have a wonderful day.',
    },
    {
      title: 'Weather Talk',
      text: 'The weather is beautiful today. The sun is shining brightly and there are no clouds in the sky.',
    },
    {
      title: 'Self Introduction',
      text: 'My name is Alex. I am a student at the university. I enjoy studying English and meeting new people.',
    },
  ],
  'ko-KR': [
    {
      title: '일상 인사',
      text: '안녕하세요. 오늘 날씨가 정말 좋네요. 기분 좋은 하루 보내세요.',
    },
    {
      title: '자기소개',
      text: '저는 대학교에 다니고 있는 학생입니다. 한국어를 열심히 공부하고 있습니다.',
    },
    {
      title: '감사 표현',
      text: '도와주셔서 정말 감사합니다. 덕분에 많은 것을 배웠습니다.',
    },
  ],
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  word_substitution: 'bg-red-100 text-red-700',
  word_omission: 'bg-orange-100 text-orange-700',
  word_insertion: 'bg-yellow-100 text-yellow-700',
  stress_error: 'bg-purple-100 text-purple-700',
  intonation_error: 'bg-blue-100 text-blue-700',
  vowel_error: 'bg-pink-100 text-pink-700',
  consonant_error: 'bg-indigo-100 text-indigo-700',
}

interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null
}

interface ISpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

export default function PronunciationPage() {
  const t = useTranslations('pages.student.pronunciation')

  const [language, setLanguage] = useState<PronunciationLanguage>('en-US')
  const [targetText, setTargetText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<PronunciationAnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSample, setSelectedSample] = useState<number | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const errorTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      word_substitution: t('errorWordSubstitution'),
      word_omission: t('errorWordOmission'),
      word_insertion: t('errorWordInsertion'),
      stress_error: t('errorStressError'),
      intonation_error: t('errorIntonationError'),
      vowel_error: t('errorVowelError'),
      consonant_error: t('errorConsonantError'),
    }
    return map[type] ?? type
  }

  const startRecording = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError(t('noSupportError'))
      return
    }
    if (!targetText.trim()) {
      setError(t('noTextError'))
      return
    }

    const recognition = new SR()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsRecording(true)
      setTranscript('')
      setResult(null)
      setError(null)
    }

    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const current = Array.from(e.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join('')
      setTranscript(current)
    }

    recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      setError(`Recording error: ${e.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [language, targetText, t])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const analyze = useCallback(async () => {
    if (!transcript.trim() || !targetText.trim()) return
    setIsAnalyzing(true)
    setError(null)

    try {
      const res = await fetch('/api/pronunciation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetText, recognizedText: transcript, language }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('analysisFailedError'))
        return
      }
      setResult(data as PronunciationAnalyzeResponse)
    } catch {
      setError(t('networkError'))
    } finally {
      setIsAnalyzing(false)
    }
  }, [transcript, targetText, language, t])

  const selectSample = (idx: number) => {
    setTargetText(SAMPLE_TEXTS[language][idx].text)
    setSelectedSample(idx)
    setTranscript('')
    setResult(null)
  }

  const switchLanguage = (lang: PronunciationLanguage) => {
    setLanguage(lang)
    setTargetText('')
    setSelectedSample(null)
    setTranscript('')
    setResult(null)
    setError(null)
  }

  const scoreColor = (s: number) => (s >= 90 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600')
  const scoreBg = (s: number) =>
    s >= 90 ? 'bg-green-50 border-green-200' : s >= 70 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
  const scoreEmoji = (s: number) => (s >= 90 ? '🌟' : s >= 70 ? '👍' : '💪')

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <a href="/pronunciation/history" className="text-sm text-indigo-600 hover:underline">
          {t('historyLink')}
        </a>
      </div>

      <div className="flex gap-2">
        {(['en-US', 'ko-KR'] as PronunciationLanguage[]).map(lang => (
          <button
            key={lang}
            onClick={() => switchLanguage(lang)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              language === lang
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {lang === 'en-US' ? `🇺🇸 ${t('langEnUS')}` : `🇰🇷 ${t('langKoKR')}`}
          </button>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('sampleTextsTitle')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_TEXTS[language].map((sample, idx) => (
            <button
              key={idx}
              onClick={() => selectSample(idx)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedSample === idx
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">{t('textInputLabel')}</label>
        <textarea
          value={targetText}
          onChange={e => {
            setTargetText(e.target.value)
            setSelectedSample(null)
          }}
          placeholder={t('textInputPlaceholder')}
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!targetText.trim()}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>🎙</span> {t('startRecording')}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex animate-pulse items-center gap-2 rounded-full bg-red-500 px-6 py-3 font-medium text-white transition-colors hover:bg-red-600"
          >
            <span>⏹</span> {t('stop')}
          </button>
        )}

        {transcript && !isRecording && (
          <button
            onClick={analyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {isAnalyzing ? t('analyzing') : `✨ ${t('analyze')}`}
          </button>
        )}
      </div>

      {(isRecording || transcript) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">
            {isRecording ? `🔴 ${t('recordingLabel')}` : t('speechLabel')}
          </p>
          <p className="min-h-[1.5rem] text-sm text-slate-800">
            {transcript || <span className="italic text-slate-400">{t('listeningPlaceholder')}</span>}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <hr className="border-slate-200" />
          <h2 className="text-lg font-bold text-slate-900">{t('resultsTitle')}</h2>

          <div className={`rounded-xl border px-6 py-5 ${scoreBg(result.accuracy_score)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{t('accuracyLabel')}</p>
                <p className={`mt-1 text-4xl font-bold ${scoreColor(result.accuracy_score)}`}>
                  {result.accuracy_score}%
                </p>
              </div>
              <span className="text-5xl">{scoreEmoji(result.accuracy_score)}</span>
            </div>
          </div>

          {result.analysis.errors.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                {t('issuesFound', { count: result.analysis.errors.length })}
              </h3>
              <div className="space-y-2">
                {result.analysis.errors.map((err: PronunciationError, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          ERROR_TYPE_COLORS[err.type] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {errorTypeLabel(err.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{err.word}</p>
                        {err.recognized && (
                          <p className="text-xs text-slate-500">{t('saidLabel', { text: err.recognized })}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-600">{err.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-blue-700">{t('toneFeedbackTitle')}</p>
              <p className="text-sm text-slate-700">{result.analysis.tone_feedback}</p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-purple-700">{t('stressFeedbackTitle')}</p>
              <p className="text-sm text-slate-700">{result.analysis.stress_feedback}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-slate-600">{t('overallFeedbackTitle')}</p>
            <p className="text-sm text-slate-700">{result.analysis.overall_feedback}</p>
          </div>

          {result.analysis.tips.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('tipsTitle')}</h3>
              <ul className="space-y-1">
                {result.analysis.tips.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 shrink-0 text-indigo-500">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setTranscript('')
              setResult(null)
            }}
            className="w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}
    </main>
  )
}
