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

-- ------------------------------------------------------------
-- 6. Demo learning sessions (anchors for error_cards/quiz_results)
-- ------------------------------------------------------------
insert into public.sessions (
  id, student_id, class_id, chapter_number,
  draft_text, revision_text, draft_error_count, revision_error_count,
  created_at
) values
  (
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    4,
    '我把作业完成。昨天我两个小时睡了，觉得很累。我买了三个书。虽然下雨，可是我去了学校。',
    '我把作业完成了。昨天我睡了两个小时，觉得很累。我买了三本书。虽然下雨，但是我还是去了学校。',
    5, 1,
    now() - interval '2 days'
  ),
  (
    '55552222-2222-2222-2222-222222222222',
    'e3333333-3333-3333-3333-333333333333',
    'c1111111-1111-1111-1111-111111111111',
    3,
    '我三个小时学了汉语。我看完这本书。',
    '我学了三个小时汉语。我看完了这本书。',
    2, 0,
    now() - interval '1 day'
  );

-- ------------------------------------------------------------
-- 7. error_cards — 5 for 이학생, 2 for 박학생
-- ------------------------------------------------------------
insert into public.error_cards (
  id, session_id, student_id, chapter_number,
  error_span, error_type, error_subtype, correction, explanation,
  cot_reasoning, similar_example, hsk_level, is_resolved, fossilization_count,
  created_at
) values
  (
    '77771111-0000-0000-0000-000000000001',
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    4,
    '把作业完成',
    'grammar',
    '把자문',
    '把作业完成了',
    '把자문의 동사 뒤에는 결과 성분(了·결과보어·방향보어 등)이 필요합니다.',
    '[{"step":"문장 분석","content":"''把作业完成''에서 ''完成''이 단독 동사로 쓰임"},{"step":"규칙 검토","content":"把자문은 동사가 ''벌거벗은 동사''일 수 없음"},{"step":"수정 제시","content":"완료상 ''了'' 추가"}]'::jsonb,
    '我把房间打扫干净了',
    4, true, 2,
    now() - interval '2 days'
  ),
  (
    '77771111-0000-0000-0000-000000000002',
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    4,
    '两个小时睡了',
    'grammar',
    '어순(시량보어)',
    '睡了两个小时',
    '시량보어는 동사 뒤에 위치해야 합니다.',
    '[{"step":"문장 분석","content":"''两个小时''는 시량보어"},{"step":"규칙 검토","content":"시량보어는 동사 뒤 위치 규칙"},{"step":"수정 제시","content":"''睡了两个小时''로 교정"}]'::jsonb,
    '我等了你一个小时',
    4, true, 3,
    now() - interval '2 days'
  ),
  (
    '77771111-0000-0000-0000-000000000003',
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    4,
    '三个书',
    'vocab',
    '양사 오류',
    '三本书',
    '책의 양사는 ''本''이며, ''个''는 일반 사물 양사입니다.',
    '[{"step":"문장 분석","content":"수량구 ''三个书''"},{"step":"규칙 검토","content":"''书''의 전용 양사는 ''本''"},{"step":"수정 제시","content":"''三本书''"}]'::jsonb,
    '我有两本汉语词典',
    2, true, 1,
    now() - interval '2 days'
  ),
  (
    '77771111-0000-0000-0000-000000000004',
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    4,
    '可是我去了学校',
    'vocab',
    '접속사',
    '但是我还是去了学校',
    '''虽然''과 짝을 이루는 접속사는 ''但是''가 더 자연스럽고, 행위 감행 의미에 ''还是'' 추가.',
    '[{"step":"문장 분석","content":"''虽然...可是''"},{"step":"규칙 검토","content":"표준 호응 ''虽然...但是''"},{"step":"수정 제시","content":"''但是...还是''"}]'::jsonb,
    '虽然累，但是他还是坚持完成了作业',
    5, false, 0,
    now() - interval '2 days'
  ),
  (
    '77771111-0000-0000-0000-000000000005',
    '55551111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222',
    4,
    '作业完成',
    'grammar',
    '把자문',
    '作业完成了',
    '반복 출현 — 把자문 결과 성분 누락 화석화 경고',
    '[{"step":"진단","content":"동일 오류 3회 반복, 화석화 위험"}]'::jsonb,
    null,
    4, false, 3,
    now() - interval '2 days'
  ),
  (
    '77772222-0000-0000-0000-000000000001',
    '55552222-2222-2222-2222-222222222222',
    'e3333333-3333-3333-3333-333333333333',
    3,
    '三个小时学了',
    'grammar',
    '어순(시량보어)',
    '学了三个小时',
    '시량보어는 동사 뒤.',
    '[{"step":"규칙 검토","content":"동사+시량"},{"step":"수정","content":"''学了三个小时''"}]'::jsonb,
    '我跑了半个小时',
    4, true, 1,
    now() - interval '1 day'
  ),
  (
    '77772222-0000-0000-0000-000000000002',
    '55552222-2222-2222-2222-222222222222',
    'e3333333-3333-3333-3333-333333333333',
    3,
    '看完这本书',
    'grammar',
    '결과보어',
    '看完了这本书',
    '완료상 ''了'' 추가 필요.',
    '[{"step":"규칙 검토","content":"동사+보어+了"},{"step":"수정","content":"''看完了''"}]'::jsonb,
    '我吃完了早饭',
    3, true, 1,
    now() - interval '1 day'
  );

-- ------------------------------------------------------------
-- 8. vocabulary — 30 entries for 이학생, spaced-review schedule spread
-- ------------------------------------------------------------
insert into public.vocabulary (
  student_id, chinese, pinyin, korean, source_error_id, review_count, next_review_at, created_at
)
select
  'e2222222-2222-2222-2222-222222222222'::uuid,
  entry->>'c',
  entry->>'p',
  entry->>'k',
  nullif(entry->>'src', '')::uuid,
  (entry->>'r')::int,
  now() + ((entry->>'d')::int || ' days')::interval,
  now() - interval '10 days' + ((row_number() over () - 1) || ' hours')::interval
from jsonb_array_elements($$[
  {"c":"把","p":"bǎ","k":"~을/를 (처치구문 조사)","src":"77771111-0000-0000-0000-000000000001","r":3,"d":-1},
  {"c":"完成","p":"wánchéng","k":"완성하다","src":"77771111-0000-0000-0000-000000000001","r":2,"d":0},
  {"c":"小时","p":"xiǎoshí","k":"시간","src":"77771111-0000-0000-0000-000000000002","r":5,"d":1},
  {"c":"睡觉","p":"shuìjiào","k":"자다","src":"77771111-0000-0000-0000-000000000002","r":4,"d":2},
  {"c":"本","p":"běn","k":"권 (책 양사)","src":"77771111-0000-0000-0000-000000000003","r":1,"d":0},
  {"c":"个","p":"gè","k":"개 (일반 양사)","src":"77771111-0000-0000-0000-000000000003","r":6,"d":5},
  {"c":"但是","p":"dànshì","k":"그러나","src":"77771111-0000-0000-0000-000000000004","r":0,"d":-2},
  {"c":"虽然","p":"suīrán","k":"비록 ~할지라도","src":"77771111-0000-0000-0000-000000000004","r":2,"d":1},
  {"c":"还是","p":"háishi","k":"여전히, 그래도","src":"77771111-0000-0000-0000-000000000004","r":1,"d":0},
  {"c":"学习","p":"xuéxí","k":"공부하다","src":"","r":8,"d":7},
  {"c":"汉语","p":"Hànyǔ","k":"중국어","src":"","r":10,"d":14},
  {"c":"学校","p":"xuéxiào","k":"학교","src":"","r":7,"d":5},
  {"c":"老师","p":"lǎoshī","k":"선생님","src":"","r":9,"d":10},
  {"c":"同学","p":"tóngxué","k":"급우","src":"","r":4,"d":3},
  {"c":"图书馆","p":"túshūguǎn","k":"도서관","src":"","r":2,"d":1},
  {"c":"借","p":"jiè","k":"빌리다","src":"","r":1,"d":0},
  {"c":"还","p":"huán","k":"돌려주다","src":"","r":0,"d":-1},
  {"c":"经常","p":"jīngcháng","k":"자주","src":"","r":3,"d":2},
  {"c":"有时候","p":"yǒushíhou","k":"가끔","src":"","r":2,"d":4},
  {"c":"觉得","p":"juéde","k":"~라고 느끼다","src":"","r":5,"d":3},
  {"c":"认为","p":"rènwéi","k":"~라고 여기다","src":"","r":2,"d":6},
  {"c":"希望","p":"xīwàng","k":"희망하다","src":"","r":3,"d":5},
  {"c":"打算","p":"dǎsuàn","k":"계획하다","src":"","r":1,"d":2},
  {"c":"准备","p":"zhǔnbèi","k":"준비하다","src":"","r":4,"d":1},
  {"c":"因为","p":"yīnwèi","k":"~때문에","src":"","r":6,"d":8},
  {"c":"所以","p":"suǒyǐ","k":"그래서","src":"","r":6,"d":8},
  {"c":"如果","p":"rúguǒ","k":"만약","src":"","r":3,"d":4},
  {"c":"就","p":"jiù","k":"바로, 곧","src":"","r":7,"d":6},
  {"c":"才","p":"cái","k":"비로소","src":"","r":2,"d":2},
  {"c":"一直","p":"yīzhí","k":"계속, 줄곧","src":"","r":5,"d":9}
]$$::jsonb) as entry;

-- ------------------------------------------------------------
-- 9. bookmarks — 10 sentences for 이학생
--    First 5 linked to specific error_cards (context-preserving bookmark),
--    remaining 5 free-form example sentences.
-- ------------------------------------------------------------
insert into public.bookmarks (student_id, error_card_id, sentence, note, created_at) values
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000001', '我把房间打扫干净了。',          '把자문 완성형', now() - interval '9 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000002', '我等了你一个小时。',           '시량보어 표준 패턴', now() - interval '8 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000003', '我有两本汉语词典。',           '양사 ''本'' 예문', now() - interval '7 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000004', '虽然累，但是他还是坚持完成了作业。', '虽然/但是/还是 3단 호응', now() - interval '6 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000005', '我把作业做完了。',             '把자문 재진단 후 성공 사례', now() - interval '5 days'),
  ('e2222222-2222-2222-2222-222222222222', null,                                    '学而时习之，不亦说乎。',         '논어 — 복습의 중요성', now() - interval '4 days'),
  ('e2222222-2222-2222-2222-222222222222', null,                                    '千里之行，始于足下。',           '도덕경', now() - interval '3 days'),
  ('e2222222-2222-2222-2222-222222222222', null,                                    '熟能生巧。',                    '숙련이 기술을 낳는다', now() - interval '2 days'),
  ('e2222222-2222-2222-2222-222222222222', null,                                    '活到老，学到老。',              '평생 학습', now() - interval '1 day'),
  ('e2222222-2222-2222-2222-222222222222', null,                                    '条条大路通罗马。',              '모든 길은 로마로 통한다', now() - interval '12 hours');

-- ------------------------------------------------------------
-- 10. quiz_results — 20 attempts across both students
--     이학생: 14 attempts (mix correct/incorrect, recent)
--     박학생: 6 attempts
-- ------------------------------------------------------------
insert into public.quiz_results (student_id, error_card_id, is_correct, answered_at) values
  -- 이학생 — 5 cards × 2-3 attempts each
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000001', false, now() - interval '7 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000001', true,  now() - interval '5 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000001', true,  now() - interval '1 day'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000002', true,  now() - interval '6 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000002', true,  now() - interval '3 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000002', true,  now() - interval '12 hours'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000003', true,  now() - interval '6 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000003', true,  now() - interval '2 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000004', false, now() - interval '5 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000004', false, now() - interval '3 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000004', true,  now() - interval '1 day'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000005', false, now() - interval '4 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000005', false, now() - interval '2 days'),
  ('e2222222-2222-2222-2222-222222222222', '77771111-0000-0000-0000-000000000005', true,  now() - interval '6 hours'),
  -- 박학생 — 2 cards × 3 attempts
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000001', false, now() - interval '2 days'),
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000001', true,  now() - interval '1 day'),
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000001', true,  now() - interval '4 hours'),
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000002', true,  now() - interval '1 day'),
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000002', true,  now() - interval '8 hours'),
  ('e3333333-3333-3333-3333-333333333333', '77772222-0000-0000-0000-000000000002', false, now() - interval '2 hours');
