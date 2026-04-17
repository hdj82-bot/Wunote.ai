"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface Props {
  classId: string;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt";

export default function CorpusUploader({ classId, disabled, disabledReason }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function acceptFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("파일 크기가 10MB를 초과합니다.");
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading || disabled) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("classId", classId);
      form.set("file", file);
      if (isPublic) form.set("isPublic", "true");
      const res = await fetch("/api/corpus/upload", { method: "POST", body: form });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? "업로드에 실패했습니다.";
        throw new Error(msg);
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setUploading(false);
    }
  }

  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        {disabledReason ?? "업로드가 비활성화되어 있습니다."}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition ${
          dragging
            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
            : "border-slate-300 bg-white text-slate-600"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-2xl" aria-hidden>
          📄
        </span>
        {file ? (
          <span className="font-medium text-slate-800">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </span>
        ) : (
          <>
            <span className="font-medium">파일을 여기로 끌어오거나 클릭</span>
            <span className="text-xs text-slate-500">PDF · DOCX · TXT (최대 10MB, 수업당 20개)</span>
          </>
        )}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        다른 교수자에게 공개 (마켓플레이스)
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!file || uploading} className="w-full">
        {uploading ? "업로드 중…" : "업로드"}
      </Button>
    </form>
  );
}
