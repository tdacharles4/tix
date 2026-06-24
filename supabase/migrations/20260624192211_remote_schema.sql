drop extension if exists "pg_net";

create type "public"."location_type" as enum ('presencial', 'en_linea', 'tba');

create type "public"."presencial_type" as enum ('lugar_unico', 'origen_destino');

alter table "public"."tickets" drop constraint "tickets_qr_code_key";

drop function if exists "public"."reserve_tickets"(p_event_id uuid, p_quantity integer, p_buyer_email text, p_buyer_name text, p_platform_fee numeric, p_buyer_id uuid);

drop index if exists "public"."tickets_qr_code_key";


  create table "public"."checkout_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "ticket_type_config_id" uuid,
    "max_quantity" integer not null default 1,
    "expires_at" timestamp with time zone not null default (now() + '00:30:00'::interval),
    "used" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."lugares" (
    "id" uuid not null default gen_random_uuid(),
    "organizer_id" uuid not null,
    "name" text not null,
    "url" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."ticket_phases" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "name" text not null,
    "end_date" date,
    "end_on_sold_out" boolean not null default false,
    "position" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_phases" enable row level security;


  create table "public"."ticket_type_configs" (
    "id" uuid not null default gen_random_uuid(),
    "phase_id" uuid not null,
    "event_id" uuid not null,
    "name" text not null,
    "price_mxn" numeric(10,2) not null default 0,
    "quantity" integer not null default 0,
    "enumerate_from" integer not null default 1,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_type_configs" enable row level security;

alter table "public"."events" add column "destination" text;

alter table "public"."events" add column "destination_url" text;

alter table "public"."events" add column "end_time" timestamp with time zone;

alter table "public"."events" add column "location_type" public.location_type not null default 'presencial'::public.location_type;

alter table "public"."events" add column "max_tickets_per_order" integer not null default 4;

alter table "public"."events" add column "presencial_type" public.presencial_type;

alter table "public"."events" add column "venue_url" text;

alter table "public"."events" alter column "date" drop not null;

alter table "public"."events" alter column "venue" drop not null;

alter table "public"."profiles" add column "status" text not null default 'pending'::text;

alter table "public"."tickets" drop column "qr_code";

alter table "public"."tickets" add column "holder_name" text;

CREATE UNIQUE INDEX checkout_sessions_pkey ON public.checkout_sessions USING btree (id);

CREATE INDEX lugares_organizer_id_idx ON public.lugares USING btree (organizer_id);

CREATE UNIQUE INDEX lugares_pkey ON public.lugares USING btree (id);

CREATE UNIQUE INDEX ticket_phases_pkey ON public.ticket_phases USING btree (id);

CREATE UNIQUE INDEX ticket_type_configs_pkey ON public.ticket_type_configs USING btree (id);

alter table "public"."checkout_sessions" add constraint "checkout_sessions_pkey" PRIMARY KEY using index "checkout_sessions_pkey";

alter table "public"."lugares" add constraint "lugares_pkey" PRIMARY KEY using index "lugares_pkey";

alter table "public"."ticket_phases" add constraint "ticket_phases_pkey" PRIMARY KEY using index "ticket_phases_pkey";

alter table "public"."ticket_type_configs" add constraint "ticket_type_configs_pkey" PRIMARY KEY using index "ticket_type_configs_pkey";

alter table "public"."checkout_sessions" add constraint "checkout_sessions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) not valid;

alter table "public"."checkout_sessions" validate constraint "checkout_sessions_event_id_fkey";

alter table "public"."checkout_sessions" add constraint "checkout_sessions_ticket_type_config_id_fkey" FOREIGN KEY (ticket_type_config_id) REFERENCES public.ticket_type_configs(id) not valid;

alter table "public"."checkout_sessions" validate constraint "checkout_sessions_ticket_type_config_id_fkey";

alter table "public"."lugares" add constraint "lugares_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."lugares" validate constraint "lugares_organizer_id_fkey";

alter table "public"."profiles" add constraint "profiles_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_status_check";

alter table "public"."ticket_phases" add constraint "ticket_phases_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_phases" validate constraint "ticket_phases_event_id_fkey";

alter table "public"."ticket_type_configs" add constraint "ticket_type_configs_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_type_configs" validate constraint "ticket_type_configs_event_id_fkey";

alter table "public"."ticket_type_configs" add constraint "ticket_type_configs_phase_id_fkey" FOREIGN KEY (phase_id) REFERENCES public.ticket_phases(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_type_configs" validate constraint "ticket_type_configs_phase_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.redeem_ticket(p_ticket_id uuid, p_event_id uuid, p_scanned_by text)
 RETURNS SETOF public.tickets
 LANGUAGE sql
AS $function$
    update tickets
    set status      = 'redeemed',
        redeemed_at = now(),
        redeemed_by = p_scanned_by
    where id = p_ticket_id
      and event_id = p_event_id
      and status = 'active'
    returning *;
  $function$
;

CREATE OR REPLACE FUNCTION public.reserve_tickets(p_event_id uuid, p_quantity integer, p_buyer_email text, p_buyer_name text, p_platform_fee numeric, p_buyer_id uuid DEFAULT NULL::uuid, p_unit_price_override numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_event public.events;
  v_order_id uuid;
  v_price numeric;
begin
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

  if p_quantity > v_event.max_tickets_per_order then
    raise exception 'Exceeds maximum tickets per order (%) for this event', v_event.max_tickets_per_order;
  end if;

  if (v_event.capacity - v_event.tickets_sold) < p_quantity then
    raise exception 'Not enough tickets available';
  end if;

  v_price := coalesce(p_unit_price_override, v_event.price_mxn) * p_quantity;

  update public.events
  set tickets_sold = tickets_sold + p_quantity
  where id = p_event_id;

  insert into public.orders (
    buyer_id, event_id, quantity, amount_mxn,
    platform_fee_mxn, status, buyer_email, buyer_name
  ) values (
    p_buyer_id, p_event_id, p_quantity, v_price,
    p_platform_fee, 'pending', p_buyer_email, p_buyer_name
  ) returning id into v_order_id;

  return v_order_id;
end;
$function$
;

grant delete on table "public"."checkout_sessions" to "anon";

grant insert on table "public"."checkout_sessions" to "anon";

grant references on table "public"."checkout_sessions" to "anon";

grant select on table "public"."checkout_sessions" to "anon";

grant trigger on table "public"."checkout_sessions" to "anon";

grant truncate on table "public"."checkout_sessions" to "anon";

grant update on table "public"."checkout_sessions" to "anon";

grant delete on table "public"."checkout_sessions" to "authenticated";

grant insert on table "public"."checkout_sessions" to "authenticated";

grant references on table "public"."checkout_sessions" to "authenticated";

grant select on table "public"."checkout_sessions" to "authenticated";

grant trigger on table "public"."checkout_sessions" to "authenticated";

grant truncate on table "public"."checkout_sessions" to "authenticated";

grant update on table "public"."checkout_sessions" to "authenticated";

grant delete on table "public"."checkout_sessions" to "service_role";

grant insert on table "public"."checkout_sessions" to "service_role";

grant references on table "public"."checkout_sessions" to "service_role";

grant select on table "public"."checkout_sessions" to "service_role";

grant trigger on table "public"."checkout_sessions" to "service_role";

grant truncate on table "public"."checkout_sessions" to "service_role";

grant update on table "public"."checkout_sessions" to "service_role";

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

grant delete on table "public"."lugares" to "anon";

grant insert on table "public"."lugares" to "anon";

grant references on table "public"."lugares" to "anon";

grant select on table "public"."lugares" to "anon";

grant trigger on table "public"."lugares" to "anon";

grant truncate on table "public"."lugares" to "anon";

grant update on table "public"."lugares" to "anon";

grant delete on table "public"."lugares" to "authenticated";

grant insert on table "public"."lugares" to "authenticated";

grant references on table "public"."lugares" to "authenticated";

grant select on table "public"."lugares" to "authenticated";

grant trigger on table "public"."lugares" to "authenticated";

grant truncate on table "public"."lugares" to "authenticated";

grant update on table "public"."lugares" to "authenticated";

grant delete on table "public"."lugares" to "service_role";

grant insert on table "public"."lugares" to "service_role";

grant references on table "public"."lugares" to "service_role";

grant select on table "public"."lugares" to "service_role";

grant trigger on table "public"."lugares" to "service_role";

grant truncate on table "public"."lugares" to "service_role";

grant update on table "public"."lugares" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."ticket_phases" to "anon";

grant insert on table "public"."ticket_phases" to "anon";

grant references on table "public"."ticket_phases" to "anon";

grant select on table "public"."ticket_phases" to "anon";

grant trigger on table "public"."ticket_phases" to "anon";

grant truncate on table "public"."ticket_phases" to "anon";

grant update on table "public"."ticket_phases" to "anon";

grant delete on table "public"."ticket_phases" to "authenticated";

grant insert on table "public"."ticket_phases" to "authenticated";

grant references on table "public"."ticket_phases" to "authenticated";

grant select on table "public"."ticket_phases" to "authenticated";

grant trigger on table "public"."ticket_phases" to "authenticated";

grant truncate on table "public"."ticket_phases" to "authenticated";

grant update on table "public"."ticket_phases" to "authenticated";

grant delete on table "public"."ticket_phases" to "service_role";

grant insert on table "public"."ticket_phases" to "service_role";

grant references on table "public"."ticket_phases" to "service_role";

grant select on table "public"."ticket_phases" to "service_role";

grant trigger on table "public"."ticket_phases" to "service_role";

grant truncate on table "public"."ticket_phases" to "service_role";

grant update on table "public"."ticket_phases" to "service_role";

grant delete on table "public"."ticket_type_configs" to "anon";

grant insert on table "public"."ticket_type_configs" to "anon";

grant references on table "public"."ticket_type_configs" to "anon";

grant select on table "public"."ticket_type_configs" to "anon";

grant trigger on table "public"."ticket_type_configs" to "anon";

grant truncate on table "public"."ticket_type_configs" to "anon";

grant update on table "public"."ticket_type_configs" to "anon";

grant delete on table "public"."ticket_type_configs" to "authenticated";

grant insert on table "public"."ticket_type_configs" to "authenticated";

grant references on table "public"."ticket_type_configs" to "authenticated";

grant select on table "public"."ticket_type_configs" to "authenticated";

grant trigger on table "public"."ticket_type_configs" to "authenticated";

grant truncate on table "public"."ticket_type_configs" to "authenticated";

grant update on table "public"."ticket_type_configs" to "authenticated";

grant delete on table "public"."ticket_type_configs" to "service_role";

grant insert on table "public"."ticket_type_configs" to "service_role";

grant references on table "public"."ticket_type_configs" to "service_role";

grant select on table "public"."ticket_type_configs" to "service_role";

grant trigger on table "public"."ticket_type_configs" to "service_role";

grant truncate on table "public"."ticket_type_configs" to "service_role";

grant update on table "public"."ticket_type_configs" to "service_role";

grant delete on table "public"."tickets" to "anon";

grant insert on table "public"."tickets" to "anon";

grant select on table "public"."tickets" to "anon";

grant update on table "public"."tickets" to "anon";

grant delete on table "public"."tickets" to "authenticated";

grant insert on table "public"."tickets" to "authenticated";

grant select on table "public"."tickets" to "authenticated";

grant update on table "public"."tickets" to "authenticated";

grant delete on table "public"."tickets" to "service_role";

grant insert on table "public"."tickets" to "service_role";

grant select on table "public"."tickets" to "service_role";

grant update on table "public"."tickets" to "service_role";


  create policy "organizer_manage_phases"
  on "public"."ticket_phases"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = ticket_phases.event_id) AND (events.organizer_id = auth.uid())))));



  create policy "organizer_manage_ticket_type_configs"
  on "public"."ticket_type_configs"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = ticket_type_configs.event_id) AND (events.organizer_id = auth.uid())))));



