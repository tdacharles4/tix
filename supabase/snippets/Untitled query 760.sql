create or replace function public.reserve_tickets(
  p_event_id uuid,
  p_quantity integer,
  p_buyer_email text,
  p_buyer_name text,
  p_platform_fee numeric,
  p_buyer_id uuid default null::uuid,
  p_unit_price_override numeric default null::numeric,
  p_ticket_type_config_id uuid default null::uuid
) returns uuid
language plpgsql
security definer
as $function$
declare
  v_event  public.events;
  v_config public.ticket_type_configs;
  v_phase  public.ticket_phases;
  v_order_id uuid;
  v_price numeric;
  v_phase_total_qty  integer;
  v_phase_total_sold integer;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.status <> 'live' then raise exception 'Event is not available for purchase'; end if;
  if p_quantity > v_event.max_tickets_per_order then
    raise exception 'Exceeds maximum tickets per order (%) for this event', v_event.max_tickets_per_order;
  end if;
  if (v_event.capacity - v_event.tickets_sold) < p_quantity then
    raise exception 'Not enough tickets available';
  end if;

  if p_ticket_type_config_id is not null then
    select * into v_config from public.ticket_type_configs
      where id = p_ticket_type_config_id for update;
    if not found or v_config.event_id <> p_event_id then
      raise exception 'Invalid ticket type for this event';
    end if;
    if v_config.tickets_sold + p_quantity > v_config.quantity then
      raise exception 'Not enough tickets available for this ticket type';
    end if;

    select * into v_phase from public.ticket_phases
      where id = v_config.phase_id for update;
    if not found then raise exception 'Invalid ticket phase'; end if;
    if v_phase.end_date is not null and current_date > v_phase.end_date then
      raise exception 'This phase has closed';
    end if;

    if v_phase.end_on_sold_out then
      select coalesce(sum(quantity), 0), coalesce(sum(tickets_sold), 0)
        into v_phase_total_qty, v_phase_total_sold
        from public.ticket_type_configs where phase_id = v_phase.id;
      if v_phase_total_sold + p_quantity > v_phase_total_qty then
        raise exception 'This phase is sold out';
      end if;
    end if;

    update public.ticket_type_configs
      set tickets_sold = tickets_sold + p_quantity
      where id = p_ticket_type_config_id;
  end if;

  v_price := coalesce(p_unit_price_override, v_event.price_mxn) * p_quantity;
  update public.events set tickets_sold = tickets_sold + p_quantity where id = p_event_id;

  insert into public.orders (
    buyer_id, event_id, quantity, amount_mxn, platform_fee_mxn, status, buyer_email, buyer_name
  ) values (
    p_buyer_id, p_event_id, p_quantity, v_price, p_platform_fee, 'pending', p_buyer_email, p_buyer_name
  ) returning id into v_order_id;

  return v_order_id;
end;
$function$;