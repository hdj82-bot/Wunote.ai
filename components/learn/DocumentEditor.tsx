"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export default function DocumentEditor({ value, onChange, onSubmit, isSubmitting }: Props) {
  const t = useTranslations("pages.components.documentEditor");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold text-slate-700">{t("heading")}</h2>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !value.trim()}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {isSubmitting ? t("analyzing") : t("submit")}
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
        className="min-h-0 flex-1 overflow-auto p-4 text-base leading-7 outline-none"
        aria-label={t("ariaLabel")}
      />
    </div>
  );
}
