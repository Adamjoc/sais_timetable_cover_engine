# SAIS Timetable Engine — Vercel + Supabase starter

This starter does three things:

1. keeps your existing front end
2. removes the browser API key box
3. makes the AI Copilot and tutor assignments work through a secure backend

## Files
- `index.html` — your patched front end
- `api/chat.js` — secure AI route + tutor assignment commands
- `api/tutors.js` — load/save tutor assignments
- `supabase_schema.sql` — database table to create in Supabase

## What works in this starter
- load tutor assignments from Supabase
- save tutor assignments from the Tutor Assignments tab
- use chat commands like:
  - `assign RL as tutor for A2`
  - `set tutor for A5 to MB`
  - `remove tutor for A3`
  - `who is tutor for A2?`
- ask general timetable questions through OpenAI via your backend

## What is not yet database-backed
- the full timetable data in `TT_DATA`
- absent teacher history
- workload edits
- options block edits

Those can be moved into Supabase next, once this first stage is working.
