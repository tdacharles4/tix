import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyScannerToken } from "@/lib/scanner/jwt";
import { SCANNER_COOKIE } from "@/lib/scanner/cookies";

export async function GET(req: NextRequest){
    const token = cookies().get(SCANNER_COOKIE)?.value;
    const payload = token ? await verifyScannerToken(token) : null;
    if(!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: events } = await supabase
        .from('events')
        .select('id, title, date, venue, tickets_sold, capacity')
        .eq('organizer_id', payload.organizer_id)
        .in('status', ['live'])
        .order('date', { ascending: true });
    return NextResponse.json({ events: events ?? [] });
}