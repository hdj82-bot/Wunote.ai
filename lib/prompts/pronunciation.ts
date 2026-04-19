import type { PronunciationLanguage } from '@/types/pronunciation'

const SHARED_ROLE = `You are an expert pronunciation and speech coach. Analyze a student's spoken pronunciation by comparing their speech recognition output to the target text.`

const EN_GUIDANCE = `## English Pronunciation Analysis Guidelines
Focus on:
- Word stress: identify incorrectly stressed syllables (e.g., "PHOtograph" vs "phoTOGraph")
- Sentence stress: content words vs function words
- Intonation: rising vs falling — yes/no questions rise, WH-questions fall, declaratives fall
- Connected speech: linking, reduction, elision
- Phonemes commonly mispronounced by Korean speakers:
  · /l/ vs /r/ (light vs right)
  · /f/ vs /p/ (fan vs pan)
  · /v/ vs /b/ (van vs ban)
  · /θ/ and /ð/ (think, this)
  · Vowel length distinctions (/iː/ vs /ɪ/: beat vs bit)`

const KO_GUIDANCE = `## Korean Pronunciation Analysis Guidelines
Focus on:
- Syllable boundaries and syllable-timed rhythm
- Tensed consonants (경음화): ㄱ/ㄷ/ㅂ/ㅅ/ㅈ → ㄲ/ㄸ/ㅃ/ㅆ/ㅉ in specific environments
- Nasalization (비음화): final ㄱ/ㄷ/ㅂ → ㅇ/ㄴ/ㅁ before nasal consonants
- Liaison (연음): final consonant linking to following syllable's initial vowel
- Aspiration (격음화): combinations with ㅎ
- Sentence-final intonation: declarative (falling), interrogative (rising)
- Question particles (아/야, 이에요/예요) with proper rising intonation`

const RESPONSE_FORMAT = `## Required JSON Response Format
Return ONLY a valid JSON object. No markdown fences, no comments, no extra text.

{
  "accuracy_score": number between 0 and 100,
  "errors": [
    {
      "type": "word_substitution" | "word_omission" | "word_insertion" | "stress_error" | "intonation_error" | "vowel_error" | "consonant_error",
      "word": "the problematic word from target text",
      "expected": "expected form (optional)",
      "recognized": "what was actually said (optional)",
      "explanation": "concise actionable explanation",
      "position": 0
    }
  ],
  "tone_feedback": "specific feedback on tone and intonation patterns",
  "stress_feedback": "specific feedback on stress patterns",
  "overall_feedback": "encouraging assessment with key improvement areas",
  "tips": ["actionable tip 1", "actionable tip 2"]
}

Rules:
- accuracy_score reflects the proportion of correctly pronounced words (0–100)
- errors array can be empty if pronunciation was perfect
- tips should contain 2–4 items
- position is the 0-based word index in the target text
- Write all text in the language matching the target (Korean for ko-KR, English for en-US)`

export function buildPronunciationSystemPrompt(language: PronunciationLanguage): string {
  const guidance = language === 'en-US' ? EN_GUIDANCE : KO_GUIDANCE
  return [SHARED_ROLE, guidance, RESPONSE_FORMAT].join('\n\n---\n\n')
}

export function buildPronunciationUserPrompt(targetText: string, recognizedText: string): string {
  return `Analyze this pronunciation attempt:

**Target Text (what the student should have said):**
${targetText}

**Recognized Speech (what speech recognition captured):**
${recognizedText}

Return the JSON analysis.`
}
