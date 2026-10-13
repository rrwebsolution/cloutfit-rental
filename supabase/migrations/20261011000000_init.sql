-- =============================================================================
-- Cloutfit Rental — initial schema
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'staff');
create type public.outfit_status as enum ('active', 'unavailable', 'archived');
create type public.booking_status as enum (
  'pending', 'awaiting_payment', 'payment_submitted', 'reserved', 'for_fitting',
  'confirmed', 'rented', 'returned', 'completed', 'cancelled'
);
create type public.payment_status as enum ('pending', 'submitted', 'verified', 'rejected');
create type public.payment_type as enum ('reservation_fee', 'rental', 'deposit', 'other');
create type public.fitting_status as enum ('pending', 'confirmed', 'rescheduled', 'completed', 'cancelled');
create type public.blocked_scope as enum ('all', 'rental', 'fitting');
create type public.email_status as enum ('sent', 'failed', 'skipped');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- The shop operates in the Philippines; "today" must not depend on server TZ.
create or replace function public.shop_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'staff',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email = lower(email) and email like '%_@_%'),
  mobile text not null check (char_length(mobile) between 7 and 20),
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);
create index customers_mobile_idx on public.customers (mobile);
create index customers_name_idx on public.customers (lower(full_name));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  rental_price numeric(10, 2) not null check (rental_price >= 0),
  status public.outfit_status not null default 'active',
  is_featured boolean not null default false,
  internal_notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outfits_category_idx on public.outfits (category_id);
create index outfits_status_idx on public.outfits (status);
create index outfits_created_idx on public.outfits (created_at desc);

create table public.outfit_images (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  storage_path text not null,
  url text not null,
  alt text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outfit_images_outfit_idx on public.outfit_images (outfit_id, sort_order);
create unique index outfit_images_one_primary on public.outfit_images (outfit_id) where is_primary;

create table public.outfit_variants (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  size text not null check (char_length(size) between 1 and 30),
  color text not null check (char_length(color) between 1 and 40),
  quantity integer not null default 1 check (quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outfit_id, size, color)
);
create index outfit_variants_outfit_idx on public.outfit_variants (outfit_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  -- Unguessable token that lets the customer open their own booking page.
  access_token uuid not null default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- Contact snapshot at the time of booking (historical record).
  customer_name text not null,
  customer_email text not null,
  customer_mobile text not null,
  customer_address text not null default '',
  rental_start date not null,
  rental_end date not null,
  status public.booking_status not null default 'pending',
  reservation_fee numeric(10, 2) not null default 0 check (reservation_fee >= 0),
  fee_status public.payment_status not null default 'pending',
  total_rental numeric(10, 2) not null default 0 check (total_rental >= 0),
  notes text not null default '',
  internal_notes text not null default '',
  cancel_reason text not null default '',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rental_end >= rental_start)
);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_dates_idx on public.bookings (rental_start, rental_end);
create index bookings_created_idx on public.bookings (created_at desc);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete restrict,
  variant_id uuid not null references public.outfit_variants (id) on delete restrict,
  -- Snapshot so history stays readable if the outfit is later edited.
  outfit_name text not null,
  size text not null,
  color text not null,
  rental_price numeric(10, 2) not null check (rental_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_items_booking_idx on public.booking_items (booking_id);
create index booking_items_variant_idx on public.booking_items (variant_id);
create index booking_items_outfit_idx on public.booking_items (outfit_id);

create table public.fitting_appointments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  outfit_id uuid references public.outfits (id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status public.fitting_status not null default 'pending',
  notes text not null default '',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index fittings_date_idx on public.fitting_appointments (appointment_date, start_time);
create index fittings_booking_idx on public.fitting_appointments (booking_id);
create index fittings_customer_idx on public.fitting_appointments (customer_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  payment_type public.payment_type not null default 'reservation_fee',
  method text not null check (char_length(method) between 1 and 60),
  reference_number text not null default '',
  proof_path text,
  payment_date date not null,
  status public.payment_status not null default 'submitted',
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  rejection_reason text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create index payments_customer_idx on public.payments (customer_id);
create index payments_status_idx on public.payments (status);
create index payments_created_idx on public.payments (created_at desc);

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  scope public.blocked_scope not null default 'all',
  -- null = applies to the whole shop; set = only this outfit (rental scope).
  outfit_id uuid references public.outfits (id) on delete cascade,
  reason text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index blocked_dates_range_idx on public.blocked_dates (date_from, date_to);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index status_history_booking_idx on public.booking_status_history (booking_id, created_at);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  recipient text not null,
  subject text not null,
  template text not null,
  status public.email_status not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_logs_booking_idx on public.email_logs (booking_id);
create index email_logs_created_idx on public.email_logs (created_at desc);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  description text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-year running number behind CLT-YYYY-NNNN references.
create table public.booking_counters (
  year integer primary key,
  last_value integer not null default 0
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'categories', 'outfits', 'outfit_images', 'outfit_variants',
    'bookings', 'booking_items', 'fitting_appointments', 'payments', 'blocked_dates',
    'system_settings'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Auth: profile bootstrap + role helpers
-- -----------------------------------------------------------------------------
-- Every auth user gets an INACTIVE staff profile. Access to /admin requires an
-- admin to activate it (or scripts/create-admin.mjs for the first account), so
-- open sign-ups on the Supabase project cannot reach the dashboard.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
  )
$$;

-- -----------------------------------------------------------------------------
-- Settings helpers
-- -----------------------------------------------------------------------------
create or replace function public.setting_text(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from public.system_settings where key = p_key), p_default)
$$;

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value #>> '{}' into v from public.system_settings where key = p_key;
  if v is null or v !~ '^-?[0-9]+(\.[0-9]+)?$' then return p_default; end if;
  return v::numeric;
end $$;

-- -----------------------------------------------------------------------------
-- Availability
-- -----------------------------------------------------------------------------
-- A booking holds its outfit while it is in any of these statuses.
create or replace function public.is_blocking_status(s public.booking_status)
returns boolean language sql immutable as $$
  select s in ('pending', 'awaiting_payment', 'payment_submitted', 'reserved',
               'for_fitting', 'confirmed', 'rented')
$$;

-- Last day a booking occupies its outfit. An overdue rental (still 'rented'
-- past its return date) keeps the outfit out until it actually comes back.
create or replace function public.booking_hold_end(s public.booking_status, d date)
returns date language sql stable as $$
  select case when s = 'rented' then greatest(d, public.shop_today()) else d end
$$;

-- How many units of a variant are taken on at least one day of [p_start, p_end].
create or replace function public.variant_conflicts(
  p_variant uuid, p_start date, p_end date, p_exclude_booking uuid default null
) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  where bi.variant_id = p_variant
    and public.is_blocking_status(b.status)
    and (p_exclude_booking is null or b.id <> p_exclude_booking)
    and b.rental_start <= p_end
    and public.booking_hold_end(b.status, b.rental_end) >= p_start
$$;

create or replace function public.is_variant_available(
  p_variant uuid, p_start date, p_end date, p_exclude_booking uuid default null
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v record;
begin
  select ov.quantity, ov.is_active, o.status, o.id as outfit_id
    into v
  from public.outfit_variants ov
  join public.outfits o on o.id = ov.outfit_id
  where ov.id = p_variant;

  if not found or not v.is_active or v.status <> 'active' then return false; end if;
  if p_start is null or p_end is null or p_end < p_start then return false; end if;

  if exists (
    select 1 from public.blocked_dates bd
    where bd.scope in ('all', 'rental')
      and (bd.outfit_id is null or bd.outfit_id = v.outfit_id)
      and bd.date_from <= p_end and bd.date_to >= p_start
  ) then return false; end if;

  return public.variant_conflicts(p_variant, p_start, p_end, p_exclude_booking) < v.quantity;
end $$;

-- Public, anonymised view of what is taken between two dates. Exposes no
-- customer data: only which variant, which days, and why.
create or replace function public.get_availability(
  p_from date, p_to date, p_outfit_id uuid default null
) returns table (outfit_id uuid, variant_id uuid, date_from date, date_to date, kind text)
language sql stable security definer set search_path = public as $$
  select bi.outfit_id, bi.variant_id, b.rental_start,
         public.booking_hold_end(b.status, b.rental_end),
         case when b.status = 'rented' then 'rented' else 'reserved' end
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  where public.is_blocking_status(b.status)
    and (p_outfit_id is null or bi.outfit_id = p_outfit_id)
    and b.rental_start <= p_to
    and public.booking_hold_end(b.status, b.rental_end) >= p_from
  union all
  select bd.outfit_id, null::uuid, bd.date_from, bd.date_to, 'blocked'
  from public.blocked_dates bd
  where bd.scope in ('all', 'rental')
    and (p_outfit_id is null or bd.outfit_id is null or bd.outfit_id = p_outfit_id)
    and bd.date_from <= p_to and bd.date_to >= p_from
$$;

-- DB-level double-booking guard. Runs for every write path (public booking,
-- admin reschedule, status changes), serialised per variant by an advisory
-- lock so two concurrent requests for the same dates cannot both succeed.
create or replace function public.assert_variant_free(
  p_variant uuid, p_start date, p_end date, p_exclude_booking uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_qty integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_variant::text, 7));
  select quantity into v_qty from public.outfit_variants where id = p_variant;
  if public.variant_conflicts(p_variant, p_start, p_end, p_exclude_booking) >= coalesce(v_qty, 0) then
    raise exception 'UNAVAILABLE'
      using errcode = 'P0001',
            detail = 'This outfit is already booked for one or more of the selected dates.';
  end if;
end $$;

create or replace function public.booking_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = new.booking_id;
  if public.is_blocking_status(b.status) then
    perform public.assert_variant_free(new.variant_id, b.rental_start, b.rental_end, b.id);
  end if;
  return new;
end $$;

create trigger booking_items_guard
  before insert or update of variant_id on public.booking_items
  for each row execute function public.booking_items_guard();

create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if public.is_blocking_status(new.status) and (
       new.rental_start <> old.rental_start
    or new.rental_end <> old.rental_end
    or not public.is_blocking_status(old.status)
  ) then
    for r in
      select variant_id from public.booking_items where booking_id = new.id order by variant_id
    loop
      perform public.assert_variant_free(r.variant_id, new.rental_start, new.rental_end, new.id);
    end loop;
  end if;
  return new;
end $$;

create trigger bookings_guard
  before update of rental_start, rental_end, status on public.bookings
  for each row execute function public.bookings_guard();

-- -----------------------------------------------------------------------------
-- Status history
-- -----------------------------------------------------------------------------
create or replace function public.log_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      (select id from public.profiles where id = v_actor),
      coalesce(nullif(current_setting('app.status_note', true), ''), '')
    );
  end if;
  return new;
end $$;

create trigger log_booking_status
  after insert or update of status on public.bookings
  for each row execute function public.log_booking_status();

-- Change a booking's status with an optional note recorded in the timeline.
-- SECURITY INVOKER: RLS decides who may update the booking.
create or replace function public.set_booking_status(
  p_booking_id uuid, p_status public.booking_status, p_note text default ''
) returns void language plpgsql set search_path = public as $$
begin
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update public.bookings set status = p_status where id = p_booking_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Booking not found.';
  end if;
  perform set_config('app.status_note', '', true);
end $$;

-- -----------------------------------------------------------------------------
-- Booking reference: CLT-2026-0001
-- -----------------------------------------------------------------------------
create or replace function public.next_booking_reference()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from public.shop_today())::integer;
  v_n integer;
begin
  insert into public.booking_counters as c (year, last_value) values (v_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning last_value into v_n;
  return 'CLT-' || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;

-- -----------------------------------------------------------------------------
-- Fitting appointments
-- -----------------------------------------------------------------------------
create or replace function public.is_active_fitting(s public.fitting_status)
returns boolean language sql immutable as $$
  select s in ('pending', 'confirmed', 'rescheduled')
$$;

-- Bookable slots for a day, derived from admin settings, blocked dates and
-- existing appointments. `remaining` = free seats in that slot.
create or replace function public.get_fitting_slots(p_date date, p_exclude uuid default null)
returns table (slot_time time, remaining integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_open time := public.setting_text('fitting_open_time', '10:00')::time;
  v_close time := public.setting_text('fitting_close_time', '18:00')::time;
  v_dur integer := greatest(public.setting_num('fitting_duration_minutes', 30)::integer, 5);
  v_max integer := greatest(public.setting_num('fitting_max_simultaneous', 1)::integer, 1);
  v_days jsonb := coalesce(
    (select value from public.system_settings where key = 'fitting_days'), '[1,2,3,4,5,6]'::jsonb);
  v_now timestamp := now() at time zone 'Asia/Manila';
begin
  if p_date is null or p_date < v_now::date then return; end if;
  if not (v_days @> to_jsonb(extract(dow from p_date)::integer)) then return; end if;
  if exists (
    select 1 from public.blocked_dates bd
    where bd.scope in ('all', 'fitting') and bd.outfit_id is null
      and p_date between bd.date_from and bd.date_to
  ) then return; end if;

  return query
  select s.t::time, (v_max - (
           select count(*) from public.fitting_appointments fa
           where fa.appointment_date = p_date
             and public.is_active_fitting(fa.status)
             and (p_exclude is null or fa.id <> p_exclude)
             and fa.start_time < (s.t + make_interval(mins => v_dur))::time
             and fa.end_time > s.t::time
         ))::integer
  from generate_series(
         p_date + v_open,
         p_date + v_close - make_interval(mins => v_dur),
         make_interval(mins => v_dur)
       ) as s(t)
  where s.t > v_now;
end $$;

-- Capacity guard for every write path, serialised per day.
create or replace function public.fittings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max integer := greatest(public.setting_num('fitting_max_simultaneous', 1)::integer, 1);
  v_taken integer;
begin
  if not public.is_active_fitting(new.status) then return new; end if;
  if tg_op = 'UPDATE'
     and new.appointment_date = old.appointment_date
     and new.start_time = old.start_time
     and new.end_time = old.end_time
     and public.is_active_fitting(old.status) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fitting:' || new.appointment_date::text, 7));
  select count(*) into v_taken
  from public.fitting_appointments fa
  where fa.appointment_date = new.appointment_date
    and fa.id <> new.id
    and public.is_active_fitting(fa.status)
    and fa.start_time < new.end_time
    and fa.end_time > new.start_time;

  if v_taken >= v_max then
    raise exception 'SLOT_UNAVAILABLE'
      using errcode = 'P0001', detail = 'That fitting slot was just taken. Please choose another time.';
  end if;
  return new;
end $$;

create trigger fittings_guard
  before insert or update of appointment_date, start_time, end_time, status
  on public.fitting_appointments
  for each row execute function public.fittings_guard();

-- Customer-facing slot validation (business hours, blocked days, lead time).
create or replace function public.assert_fitting_slot(p_date date, p_time time, p_exclude uuid default null)
returns time language plpgsql security definer set search_path = public as $$
declare
  v_dur integer := greatest(public.setting_num('fitting_duration_minutes', 30)::integer, 5);
begin
  perform pg_advisory_xact_lock(hashtextextended('fitting:' || p_date::text, 7));
  if not exists (
    select 1 from public.get_fitting_slots(p_date, p_exclude) s
    where s.slot_time = p_time and s.remaining > 0
  ) then
    raise exception 'SLOT_UNAVAILABLE'
      using errcode = 'P0001', detail = 'That fitting slot is no longer available. Please choose another time.';
  end if;
  return (p_time + make_interval(mins => v_dur))::time;
end $$;

create or replace function public.upsert_customer(
  p_name text, p_email text, p_mobile text, p_address text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  select id into v_id from public.customers where email = v_email;
  if v_id is null then
    insert into public.customers (full_name, email, mobile, address)
    values (trim(p_name), v_email, trim(p_mobile), coalesce(trim(p_address), ''))
    on conflict (email) do update set email = excluded.email
    returning id into v_id;
  else
    -- Never overwrite an existing record from a public form; only fill gaps.
    update public.customers
       set address = case when address = '' then coalesce(trim(p_address), '') else address end
     where id = v_id;
  end if;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- create_booking: the single atomic entry point for public reservations.
-- Everything (customer, booking, item, fitting) commits or nothing does.
-- -----------------------------------------------------------------------------
create or replace function public.create_booking(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_variant_id uuid := (p ->> 'variant_id')::uuid;
  v_start date := (p ->> 'rental_start')::date;
  v_end date := (p ->> 'rental_end')::date;
  v_fit_date date := nullif(p ->> 'fitting_date', '')::date;
  v_fit_time time := nullif(p ->> 'fitting_time', '')::time;
  v_today date := public.shop_today();
  v_max_days integer := greatest(public.setting_num('max_rental_days', 7)::integer, 1);
  v_window integer := greatest(public.setting_num('booking_window_days', 180)::integer, 1);
  v_fee numeric := greatest(public.setting_num('reservation_fee', 100), 0);
  v record;
  v_customer uuid;
  v_booking public.bookings%rowtype;
  v_fit_end time;
  v_fitting_id uuid;
begin
  select ov.id, ov.size, ov.color, ov.is_active, o.id as outfit_id, o.name, o.rental_price, o.status
    into v
  from public.outfit_variants ov
  join public.outfits o on o.id = ov.outfit_id
  where ov.id = v_variant_id;

  if not found or not v.is_active or v.status <> 'active' then
    raise exception 'OUTFIT_UNAVAILABLE'
      using errcode = 'P0001', detail = 'This outfit is not available for booking.';
  end if;

  if v_start is null or v_end is null or v_end < v_start or v_start < v_today then
    raise exception 'INVALID_DATES'
      using errcode = 'P0001', detail = 'Please choose a valid rental and return date.';
  end if;
  if (v_end - v_start + 1) > v_max_days then
    raise exception 'INVALID_DATES'
      using errcode = 'P0001', detail = format('Rentals are limited to %s days.', v_max_days);
  end if;
  if v_start > v_today + v_window then
    raise exception 'INVALID_DATES'
      using errcode = 'P0001', detail = format('Bookings open up to %s days in advance.', v_window);
  end if;

  -- Lock first, then check, so concurrent requests queue up here.
  perform pg_advisory_xact_lock(hashtextextended(v_variant_id::text, 7));
  if not public.is_variant_available(v_variant_id, v_start, v_end) then
    raise exception 'UNAVAILABLE'
      using errcode = 'P0001',
            detail = 'This outfit is already booked for one or more of the selected dates.';
  end if;

  if v_fit_date is not null and v_fit_time is not null then
    if v_fit_date > v_start then
      raise exception 'INVALID_FITTING'
        using errcode = 'P0001', detail = 'The fitting must be on or before the rental date.';
    end if;
    v_fit_end := public.assert_fitting_slot(v_fit_date, v_fit_time);
  end if;

  v_customer := public.upsert_customer(
    p ->> 'full_name', p ->> 'email', p ->> 'mobile', p ->> 'address');

  insert into public.bookings (
    reference, customer_id, customer_name, customer_email, customer_mobile, customer_address,
    rental_start, rental_end, status, reservation_fee, fee_status, total_rental, notes
  ) values (
    public.next_booking_reference(), v_customer,
    trim(p ->> 'full_name'), lower(trim(p ->> 'email')), trim(p ->> 'mobile'),
    coalesce(trim(p ->> 'address'), ''),
    v_start, v_end,
    (case when v_fee > 0 then 'awaiting_payment' else 'pending' end)::public.booking_status,
    v_fee,
    (case when v_fee > 0 then 'pending' else 'verified' end)::public.payment_status,
    v.rental_price,
    coalesce(trim(p ->> 'notes'), '')
  ) returning * into v_booking;

  insert into public.booking_items (booking_id, outfit_id, variant_id, outfit_name, size, color, rental_price)
  values (v_booking.id, v.outfit_id, v.id, v.name, v.size, v.color, v.rental_price);

  if v_fit_end is not null then
    insert into public.fitting_appointments (
      booking_id, customer_id, outfit_id, appointment_date, start_time, end_time)
    values (v_booking.id, v_customer, v.outfit_id, v_fit_date, v_fit_time, v_fit_end)
    returning id into v_fitting_id;
  end if;

  return jsonb_build_object(
    'id', v_booking.id,
    'reference', v_booking.reference,
    'access_token', v_booking.access_token,
    'fitting_id', v_fitting_id
  );
end $$;

-- Stand-alone fitting request (no reservation yet), or a fitting added to an
-- existing booking.
create or replace function public.book_fitting(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_date date := (p ->> 'fitting_date')::date;
  v_time time := (p ->> 'fitting_time')::time;
  v_booking_id uuid := nullif(p ->> 'booking_id', '')::uuid;
  v_outfit_id uuid := nullif(p ->> 'outfit_id', '')::uuid;
  v_customer uuid;
  v_end time;
  v_id uuid;
begin
  v_end := public.assert_fitting_slot(v_date, v_time);

  if v_booking_id is not null then
    select customer_id into v_customer from public.bookings where id = v_booking_id;
    if v_customer is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Booking not found.';
    end if;
    if v_outfit_id is null then
      select outfit_id into v_outfit_id from public.booking_items where booking_id = v_booking_id limit 1;
    end if;
  else
    v_customer := public.upsert_customer(
      p ->> 'full_name', p ->> 'email', p ->> 'mobile', p ->> 'address');
  end if;

  insert into public.fitting_appointments (
    booking_id, customer_id, outfit_id, appointment_date, start_time, end_time, notes)
  values (v_booking_id, v_customer, v_outfit_id, v_date, v_time, v_end, coalesce(trim(p ->> 'notes'), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'customer_id', v_customer);
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.categories enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_images enable row level security;
alter table public.outfit_variants enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.fitting_appointments enable row level security;
alter table public.payments enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.email_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.booking_counters enable row level security;

-- profiles: you can read yourself; staff read all; only admins change roles.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public catalogue (anonymous visitors): read-only, non-archived only.
create policy categories_public_read on public.categories for select to anon
  using (is_active);
create policy outfits_public_read on public.outfits for select to anon
  using (status <> 'archived');
create policy outfit_images_public_read on public.outfit_images for select to anon
  using (exists (select 1 from public.outfits o where o.id = outfit_id and o.status <> 'archived'));
create policy outfit_variants_public_read on public.outfit_variants for select to anon
  using (is_active and exists (
    select 1 from public.outfits o where o.id = outfit_id and o.status <> 'archived'));
create policy settings_public_read on public.system_settings for select to anon
  using (is_public);

-- Staff: manage the catalogue.
create policy categories_staff_all on public.categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy outfits_staff_select on public.outfits for select to authenticated
  using (public.is_staff());
create policy outfits_staff_insert on public.outfits for insert to authenticated
  with check (public.is_staff());
create policy outfits_staff_update on public.outfits for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- (no delete policy on outfits: they are archived, never deleted)
create policy outfit_images_staff_all on public.outfit_images for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy outfit_variants_staff_all on public.outfit_variants for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy blocked_dates_staff_all on public.blocked_dates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Staff: operational records. No DELETE policies — history is never removed.
create policy customers_staff_select on public.customers for select to authenticated using (public.is_staff());
create policy customers_staff_insert on public.customers for insert to authenticated with check (public.is_staff());
create policy customers_staff_update on public.customers for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy bookings_staff_select on public.bookings for select to authenticated using (public.is_staff());
create policy bookings_staff_insert on public.bookings for insert to authenticated with check (public.is_staff());
create policy bookings_staff_update on public.bookings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy booking_items_staff_select on public.booking_items for select to authenticated using (public.is_staff());
create policy booking_items_staff_insert on public.booking_items for insert to authenticated with check (public.is_staff());
create policy booking_items_staff_update on public.booking_items for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy fittings_staff_select on public.fitting_appointments for select to authenticated using (public.is_staff());
create policy fittings_staff_insert on public.fitting_appointments for insert to authenticated with check (public.is_staff());
create policy fittings_staff_update on public.fitting_appointments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy payments_staff_select on public.payments for select to authenticated using (public.is_staff());
create policy payments_staff_insert on public.payments for insert to authenticated with check (public.is_staff());
create policy payments_staff_update on public.payments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy history_staff_select on public.booking_status_history for select to authenticated
  using (public.is_staff());
create policy email_logs_staff_select on public.email_logs for select to authenticated
  using (public.is_staff());

create policy settings_staff_select on public.system_settings for select to authenticated
  using (public.is_staff());
create policy settings_admin_insert on public.system_settings for insert to authenticated
  with check (public.is_admin());
create policy settings_admin_update on public.system_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Grants (explicit, so the schema does not depend on project defaults)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Anonymous visitors: catalogue only. `internal_notes` is deliberately not
-- granted, so it can never leak through the public API.
grant select on public.categories, public.outfit_images, public.outfit_variants to anon;
grant select (id, category_id, name, slug, description, rental_price, status, is_featured, created_at)
  on public.outfits to anon;
grant select (key, value, is_public) on public.system_settings to anon;

grant select, insert, update, delete on
  public.categories, public.outfits, public.outfit_images, public.outfit_variants,
  public.blocked_dates
  to authenticated;
grant select, insert, update on
  public.customers, public.bookings, public.booking_items, public.fitting_appointments,
  public.payments, public.system_settings
  to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.booking_status_history, public.email_logs to authenticated;

grant execute on function public.get_availability(date, date, uuid) to anon, authenticated;
grant execute on function public.is_variant_available(uuid, date, date, uuid) to anon, authenticated;
grant execute on function public.get_fitting_slots(date, uuid) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
-- Trigger helpers that run inside staff writes.
grant execute on function public.is_blocking_status(public.booking_status) to anon, authenticated;
grant execute on function public.is_active_fitting(public.fitting_status) to anon, authenticated;
grant execute on function public.booking_hold_end(public.booking_status, date) to anon, authenticated;
grant execute on function public.shop_today() to anon, authenticated;
grant execute on function public.set_updated_at() to authenticated;
-- create_booking / book_fitting / upsert_customer stay service_role only: the
-- public reaches them exclusively through validated server actions.

-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('outfit-images', 'outfit-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- outfit-images: public bucket (served by public URL); only staff may write.
create policy "outfit images staff select" on storage.objects for select to authenticated
  using (bucket_id = 'outfit-images' and public.is_staff());
create policy "outfit images staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'outfit-images' and public.is_staff());
create policy "outfit images staff update" on storage.objects for update to authenticated
  using (bucket_id = 'outfit-images' and public.is_staff())
  with check (bucket_id = 'outfit-images' and public.is_staff());
create policy "outfit images staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'outfit-images' and public.is_staff());

-- payment-proofs: PRIVATE. No anon/public policies at all. Customers upload
-- through a server action (service role); staff view through short-lived
-- signed URLs.
create policy "payment proofs staff select" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_staff());

-- -----------------------------------------------------------------------------
-- Default settings & starter categories
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value, is_public, description) values
  ('business_name', '"Cloutfit Rental"', true, 'Business name shown across the site'),
  ('business_email', '"hello@cloutfitrental.com"', true, 'Public contact email'),
  ('business_mobile', '"0917 000 0000"', true, 'Public contact number'),
  ('business_address', '"Philippines"', true, 'Shop address'),
  ('business_hours', '"Monday – Saturday, 10:00 AM – 6:00 PM"', true, 'Opening hours text'),
  ('reservation_fee', '100', true, 'Reservation fee in PHP'),



  ('payment_instructions', '"Pay the reservation fee using one of the payment methods above, then submit your reference number and a screenshot of the receipt. We verify payments within the day."', true, 'Shown on the payment step'),
  ('rental_policies', '"• A reservation fee secures your outfit and dates. It is non-refundable but deductible from your rental.\n• Please bring a valid ID when claiming your outfit.\n• Outfits must be returned on or before the return date. Late returns are charged per day.\n• Do not wash, alter, or repair the outfit yourself. We take care of cleaning.\n• Damage beyond normal wear, stains that cannot be removed, or loss will be charged accordingly.\n• Rescheduling is subject to availability. Please contact us at least 3 days before your rental date."', true, 'Rental policies page'),
  ('fitting_days', '[1,2,3,4,5,6]', true, 'Weekdays open for fittings (0 = Sunday)'),
  ('fitting_open_time', '"10:00"', true, 'Fitting opening time'),
  ('fitting_close_time', '"18:00"', true, 'Fitting closing time'),
  ('fitting_duration_minutes', '30', true, 'Length of one fitting appointment'),
  ('fitting_max_simultaneous', '1', true, 'Fittings that can run at the same time'),
  ('max_rental_days', '7', true, 'Longest rental period in days'),
  ('booking_window_days', '180', true, 'How far ahead customers can book'),
  ('social_facebook', '""', true, 'Facebook page URL'),
  ('social_instagram', '""', true, 'Instagram URL'),
  ('social_tiktok', '""', true, 'TikTok URL'),
  ('notification_email', '""', false, 'Overrides ADMIN_NOTIFICATION_EMAIL when set')
on conflict (key) do nothing;

insert into public.categories (name, slug, description, sort_order) values
  ('Evening Gowns', 'evening-gowns', 'Floor-length statements for galas and formal nights.', 1),
  ('Cocktail Dresses', 'cocktail-dresses', 'Polished pieces for parties and celebrations.', 2),
  ('Filipiniana', 'filipiniana', 'Modern and classic ternos and barongs.', 3),
  ('Suits & Tuxedos', 'suits-tuxedos', 'Sharp tailoring for every formal occasion.', 4),
  ('Bridal & Entourage', 'bridal-entourage', 'For the bride, the groom, and everyone beside them.', 5),
  ('Debut & Prom', 'debut-prom', 'Show-stopping looks for milestone nights.', 6)
on conflict (slug) do nothing;
