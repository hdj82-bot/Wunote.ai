"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";

interface NavItem {
  href: string;
  label: string;
}

export default function StudentMobileNav({
  items,
  openLabel,
  closeLabel,
}: {
  items: NavItem[];
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="student-mobile-nav-drawer"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          {open ? (
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path d="M3 5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 top-[49px] z-30 bg-slate-900/30"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <nav
            id="student-mobile-nav-drawer"
            aria-label={openLabel}
            className="fixed inset-x-0 top-[49px] z-40 max-h-[calc(100dvh-49px)] overflow-y-auto border-b bg-white shadow-md"
          >
            <ul className="flex flex-col py-1">
              {items.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
