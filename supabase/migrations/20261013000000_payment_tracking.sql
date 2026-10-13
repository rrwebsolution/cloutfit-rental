-- =============================================================================
-- Cloutfit Rental — balances, partial payments, cash + change, refunds
-- Run after 20261012000000_payment_methods.sql.
--
-- Money is numeric(10,2) everywhere. Totals are never stored on the booking:
-- they are always calculated from the individual rows in `payments`, and only
-- VERIFIED payments count.
-- =============================================================================

alter type public.payment_type add value if not exists 'partial_payment';
alter type public.payment_type add value if not exists 'final_payment';
alter type public.payment_status add value if not exists 'refunded';

-- -----------------------------------------------------------------------------
-- Setting: is the reservation fee deducted from the rental total?
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value, is_public, description)
values ('deduct_reservation_fee', 'true', true,
        'ON: the reservation fee counts toward the rental total. OFF: it is a separate charge.')
on conflict (key) do nothing;

create or replace function public.fee_deductible_default()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value #>> '{}' from public.system_settings where key = 'deduct_reservation_fee'), 'true'
  ) = 'true'
$$;

-- The rule is copied onto each booking when it is created, so changing the
-- setting later never rewrites what existing customers owe.
alter table public.bookings
  add column fee_deductible boolean not null default true;
alter table public.bookings
  alter column fee_deductible set default public.fee_deductible_default();

-- -----------------------------------------------------------------------------
-- Payment transactions: cash handling + duplicate protection
-- -----------------------------------------------------------------------------
alter table public.payments
  add column cash_received numeric(10, 2) check (cash_received is null or cash_received >= 0),
  add column change_amount numeric(10, 2) check (change_amount is null or change_amount >= 0),
  -- Set by the browser once per "Confirm Payment" click. A repeated request
  -- (double click, retry) hits the unique index instead of charging twice.
  add column request_id uuid;
create unique index payments_request_id_key on public.payments (request_id) where request_id is not null;
alter table public.payments
  add constraint payments_cash_consistent
  check (cash_received is null or (change_amount is not null and cash_received = amount + change_amount));

-- -----------------------------------------------------------------------------
-- booking_payment_summary: one row per booking, calculated from `payments`.
--   total_due  = rental total (+ reservation fee when it is NOT deductible)
--   total_paid = verified reservation fee + verified rental payments
--   balance    = what the customer still owes (never negative)
-- security_invoker: the caller's Row Level Security applies (staff only).
-- -----------------------------------------------------------------------------
create view public.booking_payment_summary with (security_invoker = true) as
select
  b.id as booking_id,
  b.reference,
  b.customer_id,
  b.customer_name,
  b.status as booking_status,
  b.rental_start,
  b.rental_end,
  b.created_at,
  b.total_rental,
  b.reservation_fee,
  b.fee_deductible,
  t.total_due,
  p.fee_paid,
  p.other_paid,
  (p.fee_paid + p.other_paid)::numeric(10, 2) as total_paid,
  greatest(t.total_due - (p.fee_paid + p.other_paid), 0)::numeric(10, 2) as balance,
  greatest((p.fee_paid + p.other_paid) - t.total_due, 0)::numeric(10, 2) as overpayment,
  p.pending_count,
  p.last_payment_at,
  p.payment_refs,
  case
    when (p.fee_paid + p.other_paid) > t.total_due then 'overpaid'
    when (p.fee_paid + p.other_paid) = t.total_due then 'paid'
    when p.pending_count > 0 then 'pending_verification'
    when (p.fee_paid + p.other_paid) > 0 then 'partially_paid'
    when p.refunded_count > 0 then 'refunded'
    when p.rejected_count > 0 then 'rejected'
    else 'unpaid'
  end as payment_state
from public.bookings b
cross join lateral (
  select (b.total_rental + case when b.fee_deductible then 0 else b.reservation_fee end)::numeric(10, 2)
           as total_due
) t
cross join lateral (
  select
    coalesce(sum(pay.amount) filter (
      where pay.status::text = 'verified' and pay.payment_type::text = 'reservation_fee'), 0)::numeric(10, 2)
      as fee_paid,
    -- Security deposits and "other" are held separately and do not pay down the rental.
    coalesce(sum(pay.amount) filter (
      where pay.status::text = 'verified'
        and pay.payment_type::text in ('rental', 'partial_payment', 'final_payment')), 0)::numeric(10, 2)
      as other_paid,
    count(*) filter (where pay.status::text in ('submitted', 'pending'))::integer as pending_count,
    count(*) filter (where pay.status::text = 'rejected')::integer as rejected_count,
    count(*) filter (where pay.status::text = 'refunded')::integer as refunded_count,
    max(pay.created_at) as last_payment_at,
    coalesce(string_agg(nullif(pay.reference_number, ''), ' '), '') as payment_refs
  from public.payments pay
  where pay.booking_id = b.id
) p;

revoke all on public.booking_payment_summary from anon, authenticated;
grant select on public.booking_payment_summary to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- collect_payment: staff records a payment received directly (cash at pickup,
-- or an online transfer they have already confirmed). One transaction.
-- SECURITY INVOKER: Row Level Security limits it to staff.
-- -----------------------------------------------------------------------------
create or replace function public.collect_payment(p jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_booking_id uuid := (p ->> 'booking_id')::uuid;
  v_request_id uuid := nullif(p ->> 'request_id', '')::uuid;
  v_amount numeric(10, 2) := round((p ->> 'amount')::numeric, 2);
  v_is_cash boolean := coalesce((p ->> 'is_cash')::boolean, false);
  v_cash numeric(10, 2) := round(nullif(p ->> 'cash_received', '')::numeric, 2);
  v_method_id uuid := nullif(p ->> 'payment_method_id', '')::uuid;
  v_method text := left(coalesce(trim(p ->> 'method'), ''), 60);
  v_kind text := coalesce(nullif(p ->> 'payment_type', ''), 'auto');
  v_date date := coalesce(nullif(p ->> 'payment_date', '')::date, public.shop_today());
  v_booking public.bookings%rowtype;
  v_before public.booking_payment_summary%rowtype;
  v_after public.booking_payment_summary%rowtype;
  v_existing public.payments%rowtype;
  v_type text;
  v_change numeric(10, 2);
  v_payment_id uuid;
begin
  -- Lock the booking so two cashiers cannot both collect the same balance.
  select * into v_booking from public.bookings where id = v_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Booking not found.';
  end if;

  -- A repeated request returns the payment that was already recorded.
  if v_request_id is not null then
    select * into v_existing from public.payments where request_id = v_request_id;
    if found then
      select * into v_after from public.booking_payment_summary where booking_id = v_booking_id;
      return jsonb_build_object(
        'payment_id', v_existing.id, 'duplicate', true,
        'amount', v_existing.amount, 'cash_received', v_existing.cash_received,
        'change', v_existing.change_amount, 'method', v_existing.method,
        'payment_type', v_existing.payment_type, 'payment_date', v_existing.payment_date,
        'reference_number', v_existing.reference_number,
        'total_due', v_after.total_due, 'total_paid', v_after.total_paid,
        'balance', v_after.balance, 'overpayment', v_after.overpayment,
        'payment_state', v_after.payment_state,
        'booking_reference', v_booking.reference, 'customer_name', v_booking.customer_name);
    end if;
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'INVALID' using errcode = 'P0001', detail = 'This booking is cancelled.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID' using errcode = 'P0001', detail = 'Enter an amount greater than zero.';
  end if;
  if v_date > public.shop_today() then
    raise exception 'INVALID' using errcode = 'P0001', detail = 'Payment date cannot be in the future.';
  end if;

  select * into v_before from public.booking_payment_summary where booking_id = v_booking_id;

  if v_kind = 'auto' then
    v_type := case when v_amount >= v_before.balance then 'final_payment' else 'partial_payment' end;
  elsif v_kind in ('reservation_fee', 'rental', 'partial_payment', 'final_payment', 'deposit', 'other') then
    v_type := v_kind;
  else
    raise exception 'INVALID' using errcode = 'P0001', detail = 'Unknown payment type.';
  end if;

  if v_is_cash then
    v_method := 'Cash';
    v_method_id := null;
    if v_cash is null or v_cash < v_amount then
      raise exception 'INSUFFICIENT_CASH' using errcode = 'P0001', detail = 'Insufficient cash received.';
    end if;
    -- Cash handed over beyond the balance is change, not a payment.
    if v_type in ('rental', 'partial_payment', 'final_payment') and v_amount > v_before.balance then
      raise exception 'EXCEEDS_BALANCE' using errcode = 'P0001',
        detail = format('Amount to pay cannot be more than the remaining balance (%s). Give the excess back as change.',
                        to_char(v_before.balance, 'FM999,999,990.00'));
    end if;
    v_change := v_cash - v_amount;
  else
    v_cash := null;
    v_change := null;
    if v_method_id is not null then
      select case when lower(name) = lower(provider) then name else name || ' (' || provider || ')' end
        into v_method
      from public.payment_methods where id = v_method_id;
      if v_method is null then
        raise exception 'INVALID' using errcode = 'P0001', detail = 'That payment method no longer exists.';
      end if;
    elsif char_length(v_method) < 2 then
      raise exception 'INVALID' using errcode = 'P0001', detail = 'Choose a payment method.';
    end if;
  end if;

  insert into public.payments (
    booking_id, customer_id, amount, payment_type, payment_method_id, method, reference_number,
    payment_date, status, verified_by, verified_at, notes, cash_received, change_amount, request_id)
  values (
    v_booking_id, v_booking.customer_id, v_amount, v_type::public.payment_type, v_method_id, v_method,
    left(coalesce(trim(p ->> 'reference_number'), ''), 60),
    v_date, 'verified', (select auth.uid()), now(),
    left(coalesce(trim(p ->> 'notes'), ''), 500), v_cash, v_change, v_request_id)
  returning id into v_payment_id;

  -- Paying the reservation fee at the counter secures the booking, exactly
  -- like a verified QR payment does.
  if v_type = 'reservation_fee' then
    update public.bookings set fee_status = 'verified' where id = v_booking_id;
    if v_booking.status in ('pending', 'awaiting_payment', 'payment_submitted') then
      perform public.set_booking_status(v_booking_id, 'reserved', 'Reservation fee received in person.');
    end if;
  end if;

  select * into v_after from public.booking_payment_summary where booking_id = v_booking_id;
  return jsonb_build_object(
    'payment_id', v_payment_id, 'duplicate', false,
    'amount', v_amount, 'cash_received', v_cash, 'change', v_change, 'method', v_method,
    'payment_type', v_type, 'payment_date', v_date,
    'reference_number', left(coalesce(trim(p ->> 'reference_number'), ''), 60),
    'total_due', v_after.total_due, 'total_paid', v_after.total_paid,
    'balance', v_after.balance, 'overpayment', v_after.overpayment,
    'payment_state', v_after.payment_state,
    'booking_reference', v_booking.reference, 'customer_name', v_booking.customer_name);
end $$;

-- -----------------------------------------------------------------------------
-- refund_payment: a verified payment that was given back. It stays in the
-- history (auditable) but no longer counts as paid.
-- -----------------------------------------------------------------------------
create or replace function public.refund_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_reason text := left(coalesce(trim(p_reason), ''), 300);
begin
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001', detail = 'Please enter a reason for the refund.';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', detail = 'Payment not found.';
  end if;
  if v_payment.status::text <> 'verified' then
    raise exception 'INVALID' using errcode = 'P0001', detail = 'Only a verified payment can be refunded.';
  end if;

  update public.payments
     set status = 'refunded',
         verified_by = (select auth.uid()),
         verified_at = now(),
         verification_notes = 'Refunded: ' || v_reason
   where id = p_payment_id;

  if v_payment.payment_type::text = 'reservation_fee' then
    update public.bookings set fee_status = 'refunded' where id = v_payment.booking_id;
  end if;
end $$;

revoke all on function public.collect_payment(jsonb) from public, anon;
revoke all on function public.refund_payment(uuid, text) from public, anon;
revoke all on function public.fee_deductible_default() from public, anon;
grant execute on function public.collect_payment(jsonb) to authenticated, service_role;
grant execute on function public.refund_payment(uuid, text) to authenticated, service_role;
-- Needed by the column default when a booking row is inserted.
grant execute on function public.fee_deductible_default() to authenticated, service_role;
