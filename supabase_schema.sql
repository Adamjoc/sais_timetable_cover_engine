create table if not exists public.tutor_assignments (
  year_group text primary key,
  teacher_code text null,
  updated_at timestamptz not null default now()
);

alter table public.tutor_assignments enable row level security;

drop policy if exists "read tutor assignments" on public.tutor_assignments;
drop policy if exists "no direct browser writes" on public.tutor_assignments;

create policy "read tutor assignments"
on public.tutor_assignments
for select
to anon
using (true);

create policy "no direct browser writes"
on public.tutor_assignments
for all
to anon
using (false)
with check (false);

insert into public.tutor_assignments (year_group, teacher_code) values
('Nursery', null),
('Reception', null),
('P1', null),
('P2', null),
('P3', null),
('P4', null),
('P5', null),
('A1', null),
('A2', null),
('A3', null),
('A4', null),
('A5', null),
('A6', null),
('A7', null),
('A8', null)
on conflict (year_group) do nothing;
