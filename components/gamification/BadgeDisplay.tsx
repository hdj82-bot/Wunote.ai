export interface BadgeDisplayItem {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
}

interface Props {
  badges: BadgeDisplayItem[];
}

export default function BadgeDisplay({ badges }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg bg-white p-3 shadow-sm sm:grid-cols-6">
      {badges.map((b) => (
        <div
          key={b.id}
          title={b.name}
          className={`flex flex-col items-center gap-1 rounded p-2 text-center ${
            b.earned ? "" : "opacity-30 grayscale"
          }`}
        >
          <span className="text-2xl" aria-hidden>{b.icon}</span>
          <span className="text-[10px] text-slate-600">{b.name}</span>
        </div>
      ))}
    </div>
  );
}
