-- The project Markdown files and ElevenLabs are now the source of truth.
-- Run this once in Supabase after deploying the code that no longer reads the table.
drop function if exists public.nodemere_intercom_knowledge_ready();
drop table if exists public.knowledge_base;
