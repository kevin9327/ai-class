-- 실무AI클래스 DB 스키마 (Supabase SQL Editor에서 실행)

-- 프로필
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- 강의
create table if not exists public.courses (
  id text primary key,
  title text not null,
  active boolean not null default true
);
alter table public.courses enable row level security;
create policy "courses_public_read" on public.courses for select using (true);

-- 플랜 (결제 금액의 원본 — 승인 시 서버가 이 금액과 대조)
create table if not exists public.plans (
  code text primary key,
  course_id text not null references public.courses (id),
  name text not null,
  amount integer not null check (amount > 0)
);
alter table public.plans enable row level security;
create policy "plans_public_read" on public.plans for select using (true);

-- 주문
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references auth.users (id),
  course_id text not null references public.courses (id),
  plan_code text not null references public.plans (code),
  amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  toss_payment_key text,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
create policy "orders_insert_own_pending" on public.orders
  for insert with check (auth.uid() = user_id and status = 'pending');
-- 갱신·삭제 정책 없음: 상태 변경은 service role(edge function)만 가능

-- 수강권
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  course_id text not null references public.courses (id),
  order_id uuid references public.orders (id),
  status text not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.enrollments enable row level security;
create policy "enrollments_select_own" on public.enrollments for select using (auth.uid() = user_id);
-- 삽입은 service role만

-- 시드
insert into public.courses (id, title) values
  ('vibe-coding', '클로드 코드로 시작하는 바이브코딩'),
  ('automation', '반복 업무 자동화 실전'),
  ('ai-content', 'AI 콘텐츠 제작 실전')
on conflict (id) do update set title = excluded.title;

insert into public.plans (code, course_id, name, amount) values
  ('vibe-coding-pack4', 'vibe-coding', '1:1 라이브 4회 패키지', 499000),
  ('vibe-coding-single', 'vibe-coding', '단회 체험 2시간', 149000),
  ('vibe-coding-group', 'vibe-coding', '소그룹 1인 2시간', 89000),
  ('automation-pack4', 'automation', '1:1 라이브 4회 패키지', 499000),
  ('automation-single', 'automation', '단회 체험 2시간', 149000),
  ('automation-group', 'automation', '소그룹 1인 2시간', 89000),
  ('ai-content-pack4', 'ai-content', '1:1 라이브 4회 패키지', 499000),
  ('ai-content-single', 'ai-content', '단회 체험 2시간', 149000),
  ('ai-content-group', 'ai-content', '소그룹 1인 2시간', 89000)
on conflict (code) do update set amount = excluded.amount, name = excluded.name;
