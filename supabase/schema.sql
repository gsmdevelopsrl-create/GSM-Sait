-- ============================================================================
--  GSM Developer SRL — схема базы данных (Supabase / PostgreSQL)
--  Запустите в Supabase → SQL Editor (целиком). Идемпотентно при повторе.
-- ============================================================================

-- ── Таблицы ─────────────────────────────────────────────────────────────────

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  position   text,
  company_id uuid references public.companies(id) on delete set null,
  role       text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);
-- для уже созданных проектов
alter table public.profiles add column if not exists position text;
-- привязка Telegram-аккаунта (для Mini App)
alter table public.profiles add column if not exists telegram_id bigint;
alter table public.profiles add column if not exists telegram_username text;
create unique index if not exists profiles_telegram_id_key
  on public.profiles(telegram_id) where telegram_id is not null;

-- Телефон в молдавском формате: +373 и 8 цифр (первая — 2..9).
-- Хранится нормализованным: +373XXXXXXXX
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_md;
alter table public.profiles add constraint profiles_phone_md
  check (phone is null or phone ~ '^\+373[2-9][0-9]{7}$');

create table if not exists public.tickets (
  id          bigint generated always as identity (start with 1043) primary key,
  title       text not null,
  category    text not null default 'Доработка'
              check (category in ('Внедрение','Доработка','Поддержка','Обучение','Интеграция')),
  priority    text not null default 'Средний'
              check (priority in ('Низкий','Средний','Высокий','Срочно')),
  status      text not null default 'Новая',
  description text,
  deadline    date,          -- желаемая дата исполнения (указывает клиент)
  estimate    integer,       -- оценка работ в часах (ставит администратор)
  rejection_reason text,     -- причина отказа клиента при статусе «Отклонена»
  company_id  uuid references public.companies(id) on delete set null,
  author_id   uuid references public.profiles(id) on delete set null,
  assignee    text not null default '—',
  source      text default 'site',   -- откуда пришла заявка: site | telegram
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tickets_company_idx on public.tickets(company_id);
create index if not exists tickets_status_idx  on public.tickets(status);

-- для уже созданных проектов
alter table public.tickets add column if not exists source text default 'site';
update public.tickets set source = 'site' where source is null;
alter table public.tickets drop constraint if exists tickets_source_chk;
alter table public.tickets add constraint tickets_source_chk
  check (source in ('site','telegram'));

alter table public.tickets add column if not exists rejection_reason text;
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets drop constraint if exists tickets_status_chk;
alter table public.tickets add constraint tickets_status_chk
  check (status in ('Новая','На утверждении','Утверждена','Отклонена',
                    'В работе','На проверке','Выполнена'));

create table if not exists public.ticket_comments (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  bigint not null references public.tickets(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  author_name text not null,
  is_client  boolean not null default true,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_ticket_idx on public.ticket_comments(ticket_id);

create table if not exists public.ticket_attachments (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  bigint not null references public.tickets(id) on delete cascade,
  type       text not null check (type in ('image','file','link')),
  name       text not null,
  url        text,            -- для type='link' — сама ссылка
  storage_path text,          -- для загруженных файлов — путь в бакете ticket-files
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists attachments_ticket_idx on public.ticket_attachments(ticket_id);
alter table public.ticket_attachments add column if not exists storage_path text;
alter table public.ticket_attachments add column if not exists size_bytes bigint;
-- Распознанный текст с картинки (null = ещё не распознавали, '' = текста нет)
alter table public.ticket_attachments add column if not exists ocr_text text;

-- Отметка о прочтении переписки: у каждого пользователя своя по каждой заявке
create table if not exists public.ticket_reads (
  ticket_id    bigint not null references public.tickets(id) on delete cascade,
  user_id      uuid   not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

-- Заявки с лендинга (публичная форма «Оставьте заявку»)
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  contact    text,
  message    text,
  created_at timestamptz not null default now()
);

-- ── Вспомогательные функции (SECURITY DEFINER — обходят RLS, без рекурсии) ────

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_company()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.can_access_ticket(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tickets t
    where t.id = tid and t.company_id = public.current_company()
  );
$$;

-- ── Автосоздание профиля при регистрации ─────────────────────────────────────
-- Компания создаётся/подхватывается по названию из метаданных регистрации.
-- Роль всегда 'client' (админа назначают вручную — см. README).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company text := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  v_name    text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_phone   text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  v_pos     text := nullif(trim(new.raw_user_meta_data ->> 'position'), '');
  v_cid     uuid;
begin
  if v_company is not null then
    insert into public.companies(name) values (v_company)
    on conflict (name) do nothing;
    select id into v_cid from public.companies where name = v_company;
  end if;

  insert into public.profiles(id, full_name, company_id, role, phone, position)
  values (new.id, coalesce(v_name, split_part(new.email, '@', 1)), v_cid, 'client',
          v_phone, v_pos);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Автообновление updated_at у заявок
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch
  before update on public.tickets
  for each row execute function public.touch_updated_at();

-- ── Редактирование своего профиля (имя + компания) ──────────────────────────
-- SECURITY DEFINER: позволяет и клиенту, и админу привязать/создать компанию
-- по названию, не нарушая RLS. Меняет только профиль текущего пользователя.
drop function if exists public.update_my_profile(text, text);
drop function if exists public.update_my_profile(text, text, text);
create or replace function public.update_my_profile(
  p_full_name text, p_company text, p_position text, p_phone text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name    text := nullif(trim(p_full_name), '');
  v_company text := nullif(trim(p_company), '');
  v_phone   text := nullif(trim(p_phone), '');
  v_cid     uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if v_company is not null then
    insert into public.companies(name) values (v_company)
    on conflict (name) do nothing;
    select id into v_cid from public.companies where name = v_company;
  end if;

  update public.profiles
  set full_name  = coalesce(v_name, full_name),
      company_id = coalesce(v_cid, company_id),
      position   = nullif(trim(p_position), ''),
      phone      = coalesce(v_phone, phone)
  where id = auth.uid();
end;
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_comments    enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.leads              enable row level security;

-- companies: свою компанию видит клиент, все — админ
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.is_admin() or id = public.current_company());
drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: свой профиль + админ видит всех
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- tickets: клиент видит заявки своей компании и создаёт их; менять статус может админ
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated
  using (public.is_admin() or company_id = public.current_company());
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
  with check (
    public.is_admin()
    or (company_id = public.current_company() and author_id = auth.uid())
  );
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete to authenticated
  using (public.is_admin());

-- comments: доступ по заявке
drop policy if exists comments_select on public.ticket_comments;
create policy comments_select on public.ticket_comments for select to authenticated
  using (public.can_access_ticket(ticket_id));
drop policy if exists comments_insert on public.ticket_comments;
create policy comments_insert on public.ticket_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_ticket(ticket_id));

-- attachments: доступ по заявке
drop policy if exists attachments_select on public.ticket_attachments;
create policy attachments_select on public.ticket_attachments for select to authenticated
  using (public.can_access_ticket(ticket_id));
drop policy if exists attachments_insert on public.ticket_attachments;
create policy attachments_insert on public.ticket_attachments for insert to authenticated
  with check (public.can_access_ticket(ticket_id));

-- ── Хранилище файлов заявок (Supabase Storage) ──────────────────────────────
-- Приватный бакет: доступ только через политики ниже или подписанные ссылки.
-- Путь файла: {ticket_id}/{случайное_имя} — по первой папке проверяем права.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-files', 'ticket-files', false, 20971520)  -- 20 МБ
on conflict (id) do nothing;

drop policy if exists ticket_files_select on storage.objects;
create policy ticket_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-files'
    and public.can_access_ticket(((storage.foldername(name))[1])::bigint)
  );

drop policy if exists ticket_files_insert on storage.objects;
create policy ticket_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-files'
    and public.can_access_ticket(((storage.foldername(name))[1])::bigint)
  );

-- Удаление файла: админ — всегда, клиент — только пока заявка «Новая».
-- Дублирует правило из кода, чтобы его нельзя было обойти в обход интерфейса.
drop policy if exists ticket_files_delete on storage.objects;
create policy ticket_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.tickets t
        where t.id = ((storage.foldername(name))[1])::bigint
          and t.company_id = public.current_company()
          and t.author_id = auth.uid()
          and t.status = 'Новая'
      )
    )
  );

-- ticket_reads: каждый видит и меняет только свои отметки о прочтении
alter table public.ticket_reads enable row level security;
drop policy if exists ticket_reads_own on public.ticket_reads;
create policy ticket_reads_own on public.ticket_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- leads: любой может оставить заявку с лендинга, читает только админ
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to anon, authenticated
  with check (true);
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (public.is_admin());
