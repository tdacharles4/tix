-- RPC: reserve_tickets
-- Atomically checks capacity and creates a pending order.
-- Uses SELECT FOR UPDATE to prevent race conditions.
create or replace function public.reserve_tickets(
  p_event_id uuid,
  p_quantity integer,
  p_buyer_email text,
  p_buyer_name text,
  p_platform_fee numeric,
  p_buyer_id uuid DEFAULT NULL
) returns uuid language plpgsql security definer as $$
declare
  v_event public.events;
  v_order_id uuid;
  v_price numeric;
begin
  -- Lock the event row for update
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_event.status <> 'live' then
    raise exception 'Event is not available for purchase';
  end if;

  if (v_event.capacity - v_event.tickets_sold) < p_quantity then
    raise exception 'Not enough tickets available';
  end if;

  v_price := v_event.price_mxn * p_quantity;

  -- Reserve: increment tickets_sold immediately (released on failure/timeout)
  update public.events
  set tickets_sold = tickets_sold + p_quantity
  where id = p_event_id;

  -- Create pending order
  insert into public.orders (
    buyer_id, event_id, quantity, amount_mxn,
    platform_fee_mxn, status, buyer_email, buyer_name
  ) values (
    p_buyer_id, p_event_id, p_quantity, v_price,
    p_platform_fee, 'pending', p_buyer_email, p_buyer_name
  ) returning id into v_order_id;

  return v_order_id;
end;
$$;

-- RPC: release_inventory
-- Decrements tickets_sold when a pending order expires or fails.
create or replace function public.release_inventory(
  p_event_id uuid,
  p_quantity integer
) returns void language plpgsql security definer as $$
begin
  update public.events
  set tickets_sold = greatest(tickets_sold - p_quantity, 0)
  where id = p_event_id;
end;
$$;
