-- Wunote realtime subscriptions.
-- classes    : professor dashboard (enrollment/grammar_focus updates propagate to students)
-- error_cards: live class mode — errors appear on professor HUD as students submit
-- sessions   : live class mode + student's own in-progress view

alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.error_cards;
alter publication supabase_realtime add table public.sessions;

-- Use REPLICA IDENTITY FULL so UPDATE/DELETE events ship the old row
-- (required for client-side diffing in Supabase realtime).
alter table public.classes      replica identity full;
alter table public.error_cards  replica identity full;
alter table public.sessions     replica identity full;
