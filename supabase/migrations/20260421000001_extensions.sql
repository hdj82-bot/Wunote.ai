-- Wunote.ai — PostgreSQL extensions
-- Run first; all other migrations depend on pgcrypto for gen_random_uuid() and crypt().

create extension if not exists "pgcrypto";
