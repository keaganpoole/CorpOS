# Editing the Nodemere voice knowledge base

This directory is the editable source for the Intercom agent's Markdown documents.

## General documents

Edit the files in `04_CONVERSATION_REFERENCE`, `05_ERROR_AND_RECOVERY`, and `06_PERSONALITY_EXPRESSION` to change guidance used by every business. The backend compares these 15 files with their ElevenLabs copies when it starts after a deployment. It uploads only missing or changed files, attaches missing copies to the live branch, and keeps their IDs ready for calls. The copies in ElevenLabs are runtime copies; edits made there will be replaced by the project files on the next sync.

Keep each file's name and purpose stable. The sync checks for exactly 15 distinct general Markdown files, so an accidental deletion or rename is reported instead of silently removing guidance from calls.

## Dynamic document templates

Edit `01_BUSINESS_INFORMATION` when you want to change the *structure* of a business document. Placeholders such as `{{hours}}` and `{{services}}` are filled from that business's existing Supabase records before the document is synced to ElevenLabs. Edit the business's actual hours, policies, services, staff, or other changing facts in Nodemere's business settings. Generated content and ElevenLabs IDs in Supabase's `knowledge_base` table are sync records, not hand-edited source files.

## Calls and recovery

Each call sends one full knowledge-base override: all general documents plus only that business's available dynamic documents. If dynamic sync fails, the call can use general documents and the existing informational tools. If the general set cannot be verified, the Intercom call does not start with the branch's default knowledge base, which may contain another business's documents.

If a general ElevenLabs copy is deleted, the next successful sync recreates it from this directory. If a dynamic copy is deleted, Nodemere recreates it from the current business records when that business's document is next validated.
