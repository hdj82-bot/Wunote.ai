-- Wunote Storage — private 'corpus' bucket for professor-uploaded RAG files.
-- File path convention: {class_id}/{filename}
--   e.g. 'c1111111-1111-1111-1111-111111111111/grammar-ch4.pdf'
-- The first folder segment is used to derive class_id for RLS checks.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'corpus',
  'corpus',
  false,                      -- private
  10 * 1024 * 1024,           -- 10 MB per file (Wunote.md)
  array[
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- Helpers: derive class_id from the first folder segment.
-- ------------------------------------------------------------
create or replace function public.corpus_class_id(p_name text)
returns uuid
language sql immutable
as $$
  select nullif((storage.foldername(p_name))[1], '')::uuid;
$$;

-- ------------------------------------------------------------
-- Policies on storage.objects for bucket 'corpus'
-- ------------------------------------------------------------
drop policy if exists "corpus_objects_professor_insert" on storage.objects;
drop policy if exists "corpus_objects_professor_update" on storage.objects;
drop policy if exists "corpus_objects_professor_delete" on storage.objects;
drop policy if exists "corpus_objects_professor_select" on storage.objects;
drop policy if exists "corpus_objects_student_select"   on storage.objects;

-- INSERT: caller must be the professor who owns the target class.
create policy "corpus_objects_professor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'corpus'
    and public.is_professor()
    and public.owns_class(public.corpus_class_id(name))
  );

-- UPDATE: only the owning professor.
create policy "corpus_objects_professor_update"
  on storage.objects for update
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  )
  with check (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

-- DELETE: only the owning professor.
create policy "corpus_objects_professor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

-- SELECT (read): owning professor.
create policy "corpus_objects_professor_select"
  on storage.objects for select
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

-- SELECT (read): students enrolled in the class that owns the file.
create policy "corpus_objects_student_select"
  on storage.objects for select
  using (
    bucket_id = 'corpus'
    and public.is_enrolled(public.corpus_class_id(name))
  );
