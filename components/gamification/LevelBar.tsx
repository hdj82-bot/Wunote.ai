interface Props {
  level: 1 | 2 | 3 | 4;
  xp: number;
}

const LEVELS = [
  { level: 1, name: "初学者", icon: "🐣", threshold: 0, next: 500 },
  { level: 2, name: "进步中", icon: "🐼", threshold: 500, next: 2000 },
  { level: 3, name: "优秀生", icon: "🐉", threshold: 2000, next: 5000 },
  { level: 4, name: "汉语达人", icon: "🏆", threshold: 5000, next: 5000 },
] as const;

export default function LevelBar({ level, xp }: Props) {
  const info = LEVELS[level - 1];
  const range = info.next - info.threshold;
  const progress =
    range > 0 ? Math.min(100, ((xp - info.threshold) / range) * 100) : 100;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 shadow-sm">
      <span className="text-2xl" aria-hidden>{info.icon}</span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-800">
            Lv.{info.level} {info.name}
          </span>
          <span>{xp} XP</span>
        </div>
        <div
          className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
