-- Wunote Phase 1 demo seed
-- Idempotent: safe to re-run via `supabase db reset`.
--
-- Creates: 1 professor + 2 students, 1 class with 2 enrollments,
-- chapter_prompts for chapters 1–7, sample earned badges, and
-- matching gamification_stats rows for both students.

-- ------------------------------------------------------------
-- 0. Wipe prior demo rows so the script is rerunnable.
--    auth.users cascades to profiles (→ enrollments, sessions, etc.),
--    so we only need to delete the auth rows here.
-- ------------------------------------------------------------
delete from auth.users
where email in (
  'prof.demo@wunote.test',
  'student1.demo@wunote.test',
  'student2.demo@wunote.test'
);

-- ------------------------------------------------------------
-- 1. Auth users (+ profiles auto-inserted by handle_new_user trigger)
-- ------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'e1111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'prof.demo@wunote.test',
    crypt('demo-password-1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"김교수","role":"professor"}',
    now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e2222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'student1.demo@wunote.test',
    crypt('demo-password-1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"이학생","role":"student","student_id":"202500001"}',
    now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e3333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'student2.demo@wunote.test',
    crypt('demo-password-1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"박학생","role":"student","student_id":"202500002"}',
    now(), now(),
    '', '', '', ''
  );

-- ------------------------------------------------------------
-- 2. Class + enrollments
-- ------------------------------------------------------------
insert into public.classes (
  id, professor_id, name, semester, invite_code, is_active, current_grammar_focus
) values (
  'c1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111',
  '중급 중국어 작문',
  '2026-1',
  'WUNOTE-DEMO',
  true,
  '把자문'
);

insert into public.enrollments (class_id, student_id) values
  ('c1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222'),
  ('c1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333');

-- ------------------------------------------------------------
-- 3. chapter_prompts — chapters 1–7 with base system prompt + 2 ICL examples
-- ------------------------------------------------------------
insert into public.chapter_prompts (class_id, chapter_number, system_prompt, icl_examples) values
  (
    'c1111111-1111-1111-1111-111111111111', 1,
    '당신은 HSK 3급 수준 중국어 학습자의 작문을 교정하는 AI입니다. 기본 어휘(日常词汇)와 단순 문장 구조 오류에 집중하세요. 오류 발견 시 문장 분석→규칙 검토→의미 판단→수정 제시→유형 분류의 5단계 CoT로 추론합니다.',
    $$[
      {"input":"我昨天去学校了学习","error_type":"grammar","error_subtype":"어순 오류","correction":"我昨天去学校学习了","explanation":"'了'는 문장 끝 또는 동사 바로 뒤에 위치해야 합니다."},
      {"input":"我有一个朋友很好","error_type":"grammar","error_subtype":"관형어","correction":"我有一个很好的朋友","explanation":"관형어는 명사 앞에 와야 합니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 2,
    '당신은 HSK 4급 수준 학습자의 작문을 교정합니다. 이번 챕터는 양사·이합사 오류에 집중합니다. 오류 발견 시 5단계 CoT로 추론하세요.',
    $$[
      {"input":"我买了三个书","error_type":"vocab","error_subtype":"양사 오류","correction":"我买了三本书","explanation":"책의 양사는 '本'입니다."},
      {"input":"我结婚了她","error_type":"grammar","error_subtype":"이합사","correction":"我跟她结婚了","explanation":"'结婚'은 이합사로 목적어를 직접 취하지 않습니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 3,
    '당신은 HSK 4급 학습자의 작문을 교정합니다. 이번 챕터는 시량보어·동량보어·결과보어 오류에 집중합니다. 5단계 CoT 추론을 적용하세요.',
    $$[
      {"input":"我两个小时睡了","error_type":"grammar","error_subtype":"어순(시량보어)","correction":"我睡了两个小时","explanation":"시량보어는 동사 뒤에 위치합니다."},
      {"input":"我看完这本书","error_type":"grammar","error_subtype":"결과보어","correction":"我看完了这本书","explanation":"완료 의미를 살리려면 '了'를 추가합니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 4,
    '당신은 HSK 4급 학습자의 작문을 교정합니다. 이번 챕터는 把자문·被자문 오류에 집중합니다. 5단계 CoT 추론을 적용하세요.',
    $$[
      {"input":"我把作业完成","error_type":"grammar","error_subtype":"把자문","correction":"我把作业完成了","explanation":"把자문의 동사 뒤에는 결과 성분이 필요합니다."},
      {"input":"书被我看","error_type":"grammar","error_subtype":"被자문","correction":"书被我看完了","explanation":"被자문도 동사 뒤에 결과 성분이 와야 합니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 5,
    '당신은 HSK 5급 학습자의 작문을 교정합니다. 이번 챕터는 연동문·겸어문·존현문 오류에 집중합니다. 5단계 CoT 추론을 적용하세요.',
    $$[
      {"input":"我去图书馆借书了","error_type":"grammar","error_subtype":"연동문","correction":"我去图书馆借了一本书","explanation":"연동문의 두 번째 동사에 동사성 요소가 필요합니다."},
      {"input":"桌子上是一本书","error_type":"grammar","error_subtype":"존현문","correction":"桌子上有一本书","explanation":"존재를 나타낼 때는 '有'를 사용합니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 6,
    '당신은 HSK 5급 학습자의 작문을 교정합니다. 이번 챕터는 복문(조건·양보·인과)과 접속사 오류에 집중합니다. 5단계 CoT 추론을 적용하세요.',
    $$[
      {"input":"虽然下雨，可是我去了学校","error_type":"vocab","error_subtype":"접속사","correction":"虽然下雨，但是我还是去了学校","explanation":"'虽然'과 짝을 이루는 접속사는 '但是'입니다."},
      {"input":"因为他很累，就睡觉了","error_type":"grammar","error_subtype":"복문","correction":"因为他很累，所以就睡觉了","explanation":"'因为'는 '所以'와 호응합니다."}
    ]$$::jsonb
  ),
  (
    'c1111111-1111-1111-1111-111111111111', 7,
    '당신은 AI 검증 모드입니다. 학습자가 입력한 AI 피드백의 타당성을 검증하고, 부정확한 부분을 반박·보완합니다. 5단계 CoT 추론을 적용하세요.',
    $$[
      {"input":"AI가 '我吃饭了' 문장에서 '了'를 오류로 지적함","error_type":"vocab","error_subtype":"AI 오진","correction":"'了'는 올바름","explanation":"완료상 '了'가 문법적으로 맞게 쓰였습니다. AI 피드백이 부정확합니다."},
      {"input":"AI가 '他很高兴地笑' 문장에서 '地'를 불필요하다고 함","error_type":"vocab","error_subtype":"AI 오진","correction":"'地'는 올바름","explanation":"부사어 표지 '地'는 올바르게 사용되었습니다."}
    ]$$::jsonb
  );

-- ------------------------------------------------------------
-- 4. Badges — catalog represented as earned badges on demo students
--    so the UI can render every badge type.
--    Student 1 (이학생): earned all 6 badge types.
--    Student 2 (박학생): earned 3 starter badges.
-- ------------------------------------------------------------
insert into public.badges (student_id, badge_type, badge_name, badge_icon) values
  ('e2222222-2222-2222-2222-222222222222', 'zero_error',    '완벽 교정',       'zero-error.svg'),
  ('e2222222-2222-2222-2222-222222222222', 'streak_7',      '연속 학습 7일',   'streak-7.svg'),
  ('e2222222-2222-2222-2222-222222222222', 'vocab_100',     '단어장 100개',    'vocab-100.svg'),
  ('e2222222-2222-2222-2222-222222222222', 'ba_master',     '把자문 마스터',   'ba-master.svg'),
  ('e2222222-2222-2222-2222-222222222222', 'explorer',      '탐구자',          'explorer.svg'),
  ('e2222222-2222-2222-2222-222222222222', 'quiz_king',     '퀴즈왕',          'quiz-king.svg'),
  ('e3333333-3333-3333-3333-333333333333', 'zero_error',    '완벽 교정',       'zero-error.svg'),
  ('e3333333-3333-3333-3333-333333333333', 'streak_7',      '연속 학습 7일',   'streak-7.svg'),
  ('e3333333-3333-3333-3333-333333333333', 'vocab_100',     '단어장 100개',    'vocab-100.svg');

-- ------------------------------------------------------------
-- 5. gamification_stats — initial levels/XP so dashboards render
-- ------------------------------------------------------------
insert into public.gamification_stats (student_id, level, xp, streak_days, last_active_date) values
  ('e2222222-2222-2222-2222-222222222222', 3, 2150, 12, current_date),
  ('e3333333-3333-3333-3333-333333333333', 2,  780,  4, current_date)
on conflict (student_id) do update set
  level = excluded.level,
  xp = excluded.xp,
  streak_days = excluded.streak_days,
  last_active_date = excluded.last_active_date,
  updated_at = now();
