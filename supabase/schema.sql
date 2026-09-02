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

-- ═══ 2026-09-03: 무료 기간 · 계정 단위 관리 ═══════════════════════════════

-- 주문 상태에 'free' 추가 (무료 기간 신청 = 금액 0, 상태 free)
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'free'));

-- 사이트 설정 (서버가 아는 무료 기간 스위치; config.js의 FREE_PERIOD와 같이 끈다)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings for select using (true);
insert into public.settings (key, value) values ('free_period', 'true'::jsonb)
on conflict (key) do nothing;

-- 가입 시 프로필 자동 생성 (이름은 signUp의 options.data.name)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 무료 기간 신청: 로그인한 본인 계정으로 주문(0원, free) + 수강권 생성. 같은 플랜 재신청은 기존 것을 돌려준다.
create or replace function public.enroll_free(p_course_id text, p_plan_code text)
returns table (out_order_id text, already boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_free boolean;
  v_order public.orders%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select (value)::boolean into v_free from public.settings where key = 'free_period';
  if not coalesce(v_free, false) then raise exception '무료 기간이 끝났습니다'; end if;
  if not exists (select 1 from public.plans where code = p_plan_code and course_id = p_course_id) then
    raise exception '알 수 없는 구성입니다';
  end if;

  select * into v_order from public.orders
   where user_id = v_uid and plan_code = p_plan_code and status = 'free'
   order by created_at desc limit 1;
  if found then
    return query select v_order.order_id, true;
    return;
  end if;

  insert into public.orders (order_id, user_id, course_id, plan_code, amount, status)
  values ('FREE' || to_char(now(), 'YYMMDDHH24MISS') || upper(substr(md5(random()::text), 1, 4)),
          v_uid, p_course_id, p_plan_code, 0, 'free')
  returning * into v_order;

  insert into public.enrollments (user_id, course_id, order_id, status)
  values (v_uid, p_course_id, v_order.id, 'active');

  return query select v_order.order_id, false;
end $$;
revoke all on function public.enroll_free(text, text) from public;
grant execute on function public.enroll_free(text, text) to authenticated;

-- 운영자용 신청 현황. public에 두면 PostgREST로 노출되므로 별도 스키마.
-- 대시보드 SQL Editor에서:  select * from admin.signups;
create schema if not exists admin;
create or replace view admin.signups as
  select o.created_at, u.email, p.name, o.course_id, o.plan_code, o.amount, o.status, o.order_id
    from public.orders o
    join auth.users u on u.id = o.user_id
    left join public.profiles p on p.id = o.user_id
   order by o.created_at desc;

