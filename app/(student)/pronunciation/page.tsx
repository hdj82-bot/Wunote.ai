'use client'

import { useState, useRef, useCallback } from 'react'
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

const ERROR_TYPE_LABELS: Record<string, string> = {
  word_substitution: 'Wrong Word',
  word_omission: 'Missed Word',
  word_insertion: 'Extra Word',
  stress_error: 'Stress Error',
  intonation_error: 'Intonation',
  vowel_error: 'Vowel Error',
  consonant_error: 'Consonant Error',
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

// Web Speech API types are not in TypeScript's lib.dom.d.ts yet.
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
  const [language, setLanguage] = useState<PronunciationLanguage>('en-US')
  const [targetText, setTargetText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<PronunciationAnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSample, setSelectedSample] = useState<number | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const startRecording = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition is not supported. Please use Chrome or Edge.')
      return
    }
    if (!targetText.trim()) {
      setError('Please select or enter a text passage first.')
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
  }, [language, targetText])

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
        setError(data.error ?? 'Analysis failed')
        return
      }
      setResult(data as PronunciationAnalyzeResponse)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [transcript, targetText, language])

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pronunciation Practice</h1>
          <p className="text-sm text-gray-500 mt-1">Read aloud and get AI-powered feedback</p>
        </div>
        <a href="/pronunciation/history" className="text-sm text-indigo-600 hover:underline">
          View History →
        </a>
      </div>

      {/* Language selector */}
      <div className="flex gap-2">
        {(['en-US', 'ko-KR'] as PronunciationLanguage[]).map(lang => (
          <button
            key={lang}
            onClick={() => switchLanguage(lang)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              language === lang
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {lang === 'en-US' ? '🇺🇸 English' : '🇰🇷 Korean'}
          </button>
        ))}
      </div>

      {/* Sample texts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Sample Texts</h2>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_TEXTS[language].map((sample, idx) => (
            <button
              key={idx}
              onClick={() => selectSample(idx)}
              className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedSample === idx
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Text input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Text to Read</label>
        <textarea
          value={targetText}
          onChange={e => {
            setTargetText(e.target.value)
            setSelectedSample(null)
          }}
          placeholder="Select a sample or type your own text here..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      {/* Recording controls */}
      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!targetText.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>🎙</span> Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-colors animate-pulse"
          >
            <span>⏹</span> Stop
          </button>
        )}

        {transcript && !isRecording && (
          <button
            onClick={analyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : '✨ Analyze'}
          </button>
        )}
      </div>

      {/* Live transcript */}
      {(isRecording || transcript) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">
            {isRecording ? '🔴 Recording...' : 'Your Speech'}
          </p>
          <p className="text-sm text-gray-800 min-h-[1.5rem]">
            {transcript || <span className="text-gray-400 italic">Listening...</span>}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <hr className="border-gray-200" />
          <h2 className="text-lg font-bold text-gray-900">Analysis Results</h2>

          <div className={`rounded-xl border px-6 py-5 ${scoreBg(result.accuracy_score)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Accuracy Score</p>
                <p className={`text-4xl font-bold mt-1 ${scoreColor(result.accuracy_score)}`}>
                  {result.accuracy_score}%
                </p>
              </div>
              <span className="text-5xl">{scoreEmoji(result.accuracy_score)}</span>
            </div>
          </div>

          {result.analysis.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Issues Found ({result.analysis.errors.length})
              </h3>
              <div className="space-y-2">
                {result.analysis.errors.map((err: PronunciationError, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          ERROR_TYPE_COLORS[err.type] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ERROR_TYPE_LABELS[err.type] ?? err.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{err.word}</p>
                        {err.recognized && (
                          <p className="text-xs text-gray-500">Said: &ldquo;{err.recognized}&rdquo;</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">{err.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Tone &amp; Intonation</p>
              <p className="text-sm text-gray-700">{result.analysis.tone_feedback}</p>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Stress Patterns</p>
              <p className="text-sm text-gray-700">{result.analysis.stress_feedback}</p>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-600 mb-1">Overall Feedback</p>
            <p className="text-sm text-gray-700">{result.analysis.overall_feedback}</p>
          </div>

          {result.analysis.tips.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Tips for Improvement</h3>
              <ul className="space-y-1">
                {result.analysis.tips.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
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
            className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
