export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'organizer' | 'buyer';
  status: 'pending' | 'approved';
  conekta_customer_id: string | null;
  created_at: string;
};

export type LocationType = 'presencial' | 'en_linea' | 'tba';
export type PresencialType = 'lugar_unico' | 'origen_destino';

export type Lugar = {
  id: string;
  organizer_id: string;
  name: string;
  url: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  date: string;
  end_time: string | null;
  location_type: LocationType;
  presencial_type: PresencialType | null;
  venue: string | null;
  venue_url: string | null;
  destination: string | null;
  destination_url: string | null;
  capacity: number;
  tickets_sold: number;
  price_mxn: number;
  status: 'draft' | 'live' | 'closed' | 'cancelled' | 'finalizado';
  conekta_product_id: string | null;
  created_at: string;
  max_tickets_per_order: number;
};

export type EventInsert = {
  organizer_id: string;
  title: string;
  description?: string | null;
  date: string;
  end_time?: string | null;
  location_type: LocationType;
  presencial_type?: PresencialType | null;
  venue?: string | null;
  venue_url?: string | null;
  destination?: string | null;
  destination_url?: string | null;
  capacity: number;
  price_mxn: number;
  status?: 'draft' | 'live' | 'closed' | 'cancelled' | 'finalizado';
  conekta_product_id?: string | null;
  tickets_sold?: number;
  max_tickets_per_order?: number
};

export type Order = {
  id: string;
  buyer_id: string;
  event_id: string;
  quantity: number;
  amount_mxn: number;
  platform_fee_mxn: number;
  conekta_order_id: string | null;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  buyer_email: string;
  buyer_name: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  order_id: string;
  event_id: string;
  buyer_id: string|null;
  buyer_email: string;
  holder_name: string | null;
  ticket_type: string;
  seat_label: string | null;
  status: 'active' | 'redeemed' | 'cancelled' | 'transferred';
  redeemed_at: string | null;
  redeemed_by: string | null;
  email_sent_at: string | null;
  original_buyer_id: string | null;
  transferred_at: string | null;
  created_at: string;
};

export type TicketPhase = {
  id: string;
  event_id: string;
  name: string;
  end_date: string | null;
  end_on_sold_out: boolean;
  position: number;
  created_at: string;
};

export type TicketTypeConfig = {
  id: string;
  phase_id: string;
  event_id: string;
  name: string;
  price_mxn: number;
  quantity: number;
  enumerate_from: number;
  created_at: string;
};

export type PhaseWithTypes = TicketPhase & { ticket_type_configs: TicketTypeConfig[] };

export type CheckoutSession = {
  id: string;
  event_id: string;
  ticket_type_config_id: string | null;
  max_quantity: number;
  expires_at: string;
  used: boolean;
  created_at: string;
};

export type TicketInsert = {
  id?: string,
  order_id: string;
  event_id: string;
  buyer_id: string|null;
  buyer_email: string;
  holder_name?: string | null;
  ticket_type?: string;
  status?: 'active' | 'redeemed' | 'cancelled' | 'transferred';
  seat_label?: string | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
  email_sent_at?: string | null;
  original_buyer_id?: string | null;
  transferred_at?: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: EventInsert;
        Update: Partial<EventInsert>;
        Relationships: [];
      };
      lugares: {
        Row: Lugar;
        Insert: Omit<Lugar, 'id' | 'created_at'> & { url?: string | null };
        Update: Partial<Omit<Lugar, 'id' | 'organizer_id' | 'created_at'>>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at'> & { conekta_order_id?: string | null };
        Update: Partial<Order>;
        Relationships: [];
      };
      tickets: {
        Row: Ticket;
        Insert: TicketInsert;
        Update: Partial<Ticket>;
        Relationships: [];
      };
      ticket_phases: {
        Row: TicketPhase;
        Insert: Omit<TicketPhase, 'id' | 'created_at'> & { end_date?: string | null; end_on_sold_out?: boolean; position?: number };
        Update: Partial<Omit<TicketPhase, 'id' | 'event_id' | 'created_at'>>;
        Relationships: [];
      };
      ticket_type_configs: {
        Row: TicketTypeConfig;
        Insert: Omit<TicketTypeConfig, 'id' | 'created_at'> & { enumerate_from?: number };
        Update: Partial<Omit<TicketTypeConfig, 'id' | 'phase_id' | 'event_id' | 'created_at'>>;
        Relationships: [];
      };
      checkout_sessions: {
        Row: CheckoutSession;
        Insert: Omit<CheckoutSession, 'id' | 'created_at'> & { expires_at?: string; used?: boolean };
        Update: Partial<Pick<CheckoutSession, 'used'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_tickets: {
        Args: {
          p_event_id: string;
          p_quantity: number;
          p_buyer_id: string|null;
          p_buyer_email: string;
          p_buyer_name: string;
          p_platform_fee: number;
        };
        Returns: string;
      };
      redeem_ticket: {
        Args: { p_ticket_id: string; p_event_id: string; p_scanned_by: string };
        Returns: Ticket[];
      };
      release_inventory: {
        Args: { p_event_id: string; p_quantity: number };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
