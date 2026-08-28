import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/lib/supabase/types';

const VALID_TRANSITIONS: Record<string, Event['status'][]> = {
  draft: ['live'],
  live:  ['closed', 'cancelled', 'finalizado'],
};

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const { status } = await req.json();

  if (!status || typeof status !== 'string') {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch event and verify ownership
  const { data: event } = await supabase
    .from('events')
    .select('status')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single();

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = VALID_TRANSITIONS[event.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${event.status}' to '${status}'` },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from('events')
    .update({ status: status as Event['status'] })
    .eq('id', id)
    .eq('organizer_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status });
}
