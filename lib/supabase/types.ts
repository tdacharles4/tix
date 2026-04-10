export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'organizer' | 'buyer';
  conekta_customer_id: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  date: string;
  venue: string;
  capacity: number;
  tickets_sold: number;
  price_mxn: number;
  status: 'draft' | 'live' | 'closed' | 'cancelled';
  conekta_product_id: string | null;
  created_at: string;
};

export type EventInsert = {
  organizer_id: string;
  title: string;
  description?: string | null;
  date: string;
  venue: string;
  capacity: number;
  price_mxn: number;
  status?: 'draft' | 'live' | 'closed' | 'cancelled';
  conekta_product_id?: string | null;
  tickets_sold?: number;
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
  ticket_type: string;
  seat_label: string | null;
  qr_code: string;
  status: 'active' | 'redeemed' | 'cancelled' | 'transferred';
  redeemed_at: string | null;
  redeemed_by: string | null;
  email_sent_at: string | null;
  original_buyer_id: string | null;
  transferred_at: string | null;
  created_at: string;
};

export type TicketInsert = {
  order_id: string;
  event_id: string;
  buyer_id: string|null;
  buyer_email: string;
  ticket_type?: string;
  qr_code: string;
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
      release_inventory: {
        Args: { p_event_id: string; p_quantity: number };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
