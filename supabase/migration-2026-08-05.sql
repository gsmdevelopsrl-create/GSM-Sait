-- ============================================================================
--  Обновление от 05.08.2026 — выполнить в Supabase → SQL Editor целиком.
--  Добавляет: телефон в профиль, хранилище файлов, поля вложений.
--  Безопасно запускать повторно.
-- ============================================================================

-- ── 1. Телефон (обязателен в формах, формат Молдовы) ────────────────────────
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_md;
alter table public.profiles add constraint profiles_phone_md
  check (phone is null or phone ~ '^\+373[2-9][0-9]{7}$');

-- ── 2. Поля вложений ────────────────────────────────────────────────────────
alter table public.ticket_attachments add column if not exists storage_path text;
alter table public.ticket_attachments add column if not exists size_bytes bigint;

-- ── 3. Профиль: телефон при регистрации и при правке ────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $func$
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
$func$;

drop function if exists public.update_my_profile(text, text);
drop function if exists public.update_my_profile(text, text, text);
create or replace function public.update_my_profile(
  p_full_name text, p_company text, p_position text, p_phone text
)
returns void language plpgsql security definer set search_path = public as $func$
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
$func$;

-- ── 4. Хранилище файлов заявок ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-files', 'ticket-files', false, 20971520)  -- 20 МБ
on conflict (id) do nothing;

-- Доступ к файлу определяется по первой папке пути = id заявки
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

-- Удаление файла: админ — всегда, клиент — только пока заявка «Новая»
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

-- ── 5. Ник Telegram и источник заявки ───────────────────────────────────────
alter table public.profiles add column if not exists telegram_username text;

alter table public.tickets add column if not exists source text default 'site';
update public.tickets set source = 'site' where source is null;
-- заявка, созданная из Telegram при тестировании бота
update public.tickets set source = 'telegram' where id = 1043;
alter table public.tickets drop constraint if exists tickets_source_chk;
alter table public.tickets add constraint tickets_source_chk
  check (source in ('site','telegram'));

-- ── 6. Согласование заявок: два новых этапа + отказ с причиной ──────────────
alter table public.tickets add column if not exists rejection_reason text;
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets drop constraint if exists tickets_status_chk;
alter table public.tickets add constraint tickets_status_chk
  check (status in ('Новая','На утверждении','Утверждена','Отклонена',
                    'В работе','На проверке','Выполнена'));

-- ── 7. Распознанный текст с картинок (OCR) ─────────────────────────────────
-- null = ещё не распознавали, '' = текста на картинке нет
alter table public.ticket_attachments add column if not exists ocr_text text;
