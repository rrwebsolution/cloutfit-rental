-- =============================================================================
-- Cloutfit Rental — QR payment methods + atomic payment verification
-- Run after 20261011000000_init.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- payment_methods: what customers can pay the reservation fee with.
-- `provider` is free text (QR Ph, GCash, Maya, a bank, anything else).
-- -----------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  provider text not null check (char_length(provider) between 1 and 60),
  account_name text not null default '',
  account_number text not null default '',
  qr_image_path text,
  instructions text not null default '',
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  -- Methods that already have payments are archived instead of deleted.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (is_default and not is_active)),
  check (not (archived_at is not null and (is_active or is_default)))
);
create unique index payment_methods_one_default on public.payment_methods (is_default) where is_default;
create index payment_methods_active_idx on public.payment_methods (sort_order) where is_active;

create trigger set_updated_at before update on public.payment_methods
  for each row execute function public.set_updated_at();

alter table public.payments
  add column payment_method_id uuid references public.payment_methods (id) on delete restrict,
  add column verification_notes text not null default '';
create index payments_method_idx on public.payments (payment_method_id);

-- Carry over the GCash details from the old settings, if any were entered.
insert into public.payment_methods (name, provider, account_name, account_number, is_default)
select 'GCash', 'GCash',
       public.setting_text('gcash_name', ''),
       public.setting_text('gcash_number', ''),
       true
where public.setting_text('gcash_number', '') <> '';

delete from public.system_settings where key in ('gcash_name', 'gcash_number', 'payment_methods');

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.payment_methods enable row level security;

-- Customers only ever see methods that are switched on.
create policy payment_methods_public_read on public.payment_methods for select to anon
  using (is_active and archived_at is null);
create policy payment_methods_staff_select on public.payment_methods for select to authenticated
  using (public.is_staff());
-- Where the money goes is an admin-only decision.
create policy payment_methods_admin_insert on public.payment_methods for insert to authenticated
  with check (public.is_admin());
create policy payment_methods_admin_update on public.payment_methods for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy payment_methods_admin_delete on public.payment_methods for delete to authenticated
  using (public.is_admin());

-- Supabase grants ALL on new tables to anon/authenticated by default. Start
-- from nothing so RLS is the second layer of protection, not the only one.
revoke all on public.payment_methods from anon, authenticated;
grant select on public.payment_methods to anon;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;

-- -----------------------------------------------------------------------------
-- Storage: QR images are public to view (customers must scan them), but only
-- admins can upload, replace or remove them.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr-codes', 'payment-qr-codes', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "payment qr admin select" on storage.objects for select to authenticated
  using (bucket_id = 'payment-qr-codes' and public.is_staff());
create policy "payment qr admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-qr-codes' and public.is_admin());
create policy "payment qr admin update" on storage.objects for update to authenticated
  using (bucket_id = 'payment-qr-codes' and public.is_admin())
  with check (bucket_id = 'payment-qr-codes' and public.is_admin());
create policy "payment qr admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr-codes' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Verification. One transaction each: the payment, the booking's fee status,
-- the booking status and its timeline entry change together or not at all.
-- SECURITY INVOKER: Row Level Security decides who may run them (staff only).
-- -----------------------------------------------------------------------------
create or replace function public.verify_payment(p_payment_id uuid, p_notes text default '')
returns void language plpgsql set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_status public.booking_status;
  v_notes text := left(coalesce(trim(p_notes), ''), 300);
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Payment not found.';
  end if;
  if v_payment.status = 'verified' then
    raise exception 'ALREADY_DONE' using errcode = 'P0001', detail = 'This payment is already verified.';
  end if;

  update public.payments
     set status = 'verified',
         verified_by = (select auth.uid()),
         verified_at = now(),
         verification_notes = v_notes,
         rejection_reason = ''
   where id = p_payment_id;

  if v_payment.payment_type = 'reservation_fee' then
    select status into v_status from public.bookings where id = v_payment.booking_id for update;
    update public.bookings set fee_status = 'verified' where id = v_payment.booking_id;
    if v_status in ('pending', 'awaiting_payment', 'payment_submitted') then
      perform public.set_booking_status(
        v_payment.booking_id, 'reserved',
        'Reservation fee verified.' || case when v_notes <> '' then ' ' || v_notes else '' end);
    end if;
  end if;
end $$;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_status public.booking_status;
  v_reason text := left(coalesce(trim(p_reason), ''), 300);
begin
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001', detail = 'Please give the customer a reason.';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Payment not found.';
  end if;
  if v_payment.status = 'rejected' then
    raise exception 'ALREADY_DONE' using errcode = 'P0001', detail = 'This payment is already rejected.';
  end if;

  update public.payments
     set status = 'rejected',
         verified_by = (select auth.uid()),
         verified_at = now(),
         rejection_reason = v_reason,
         verification_notes = ''
   where id = p_payment_id;

  if v_payment.payment_type = 'reservation_fee' then
    select status into v_status from public.bookings where id = v_payment.booking_id for update;
    update public.bookings set fee_status = 'rejected' where id = v_payment.booking_id;
    if v_status = 'payment_submitted' then
      perform public.set_booking_status(
        v_payment.booking_id, 'awaiting_payment', 'Payment rejected: ' || v_reason);
    end if;
  end if;
end $$;

revoke all on function public.verify_payment(uuid, text) from public, anon;
revoke all on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.verify_payment(uuid, text) to authenticated, service_role;
grant execute on function public.reject_payment(uuid, text) to authenticated, service_role;
