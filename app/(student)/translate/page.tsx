import TranslateCompare from "./TranslateCompare";

export default function TranslatePage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">번역 역방향 비교</h1>
        <p className="mt-1 text-xs text-slate-500">
          한국어 문장을 입력하면 DeepL · Papago · GPT 세 엔진으로 동시에 중국어 번역한 뒤,
          AI 튜터가 각 번역의 학습 포인트를 오류 카드 형식으로 설명합니다.
        </p>
      </div>
      <TranslateCompare />
    </section>
  );
}
