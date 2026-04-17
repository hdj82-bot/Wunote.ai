interface Props {
  days: number;
}

export default function StreakCounter({ days }: Props) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
      <span className="text-lg" aria-hidden>🔥</span>
      <span>{days}일 연속 학습</span>
    </div>
  );
}
