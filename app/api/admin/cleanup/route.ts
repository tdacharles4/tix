// weekly autodelete non-approved accts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(){
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cutoff = new Date(Date.now()-7*24*60*60*1000).toISOString();

    const { data: stale } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'pending')
        .lt('created_at', cutoff);

    for (const user of stale ?? []){
        await supabase.auth.admin.deleteUser(user.id);
    }

    return NextResponse.json({deleted:stale?.length??0});
}