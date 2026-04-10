-- users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  email text not null,
  full_name text,
  role text check (role in ('organizer')) default 'organizer',
  conekta_customer_id text,
  created_at timestamptz default now()
);

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.profiles not null,
  title text not null,
  description text,
  date timestamptz not null,
  venue text not null,
  capacity integer not null,
  tickets_sold integer default 0,
  price_mxn numeric(10,2) not null,
  status text check (status in ('draft','live','closed','cancelled')) default 'draft',
  conekta_product_id text,
  created_at timestamptz default now()
);

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles,
  event_id uuid references public.events not null,
  quantity integer not null default 1,
  amount_mxn numeric(10,2) not null,
  platform_fee_mxn numeric(10,2) not null,
  conekta_order_id text unique,
  status text check (status in ('pending','paid','refunded','failed')) default 'pending',
  buyer_email text not null,
  buyer_name text not null,
  created_at timestamptz default now()
);

-- tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders not null,
  event_id uuid references public.events not null,
  buyer_id uuid references public.profiles,
  buyer_email text not null,
  ticket_type text default 'general',
  seat_label text,
  qr_code text unique not null,
  status text check (status in ('active','redeemed','cancelled','transferred')) default 'active',
  redeemed_at timestamptz,
  redeemed_by text,
  email_sent_at timestamptz,
  original_buyer_id uuid references public.profiles,
  transferred_at timestamptz,
  created_at timestamptz default now()
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;

-- Organizers can manage their own events
create policy "organizers manage own events" on public.events
  for all using (organizer_id = auth.uid());

-- Anyone can view live events
create policy "public view live events" on public.events
  for select using (status = 'live');

-- Profiles: users can read/update their own
create policy "users manage own profile" on public.profiles
  for all using (id = auth.uid());

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
