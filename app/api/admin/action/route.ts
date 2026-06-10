import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend/client';
import crypto from 'crypto';

function verifyToken(userId:string,token:string):boolean{
    const expected = crypto
        .createHmac('sha256',process.env.APPROVAL_SECRET!)
        .update(userId)
        .digest('hex');
    return expected === token;
}

export async function GET(req:NextRequest){
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!userId || !token || !action || !verifyToken(userId, token)) {
        return new NextResponse('Invalid request', { status: 400 });
    }
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (action === 'approve') {
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

        await supabase
            .from('profiles')
            .update({ status: 'approved' })
            .eq('id', userId);

        if (profile?.email) {
            await resend.emails.send({
                from: 'Boletera <onboarding@resend.dev>',
                to: profile.email,
                subject: 'Tu cuenta ha sido aprobada — Boletera',
                html: `<p>Hola${profile.full_name ? ` ${profile.full_name}` : ''},</p><p>Tu solicitud de acceso a Boletera ha sido aprobada. Ya puedes iniciar sesión.</p>`,
            });
        }

        return new NextResponse('Usuario aprobado.', { status: 200 });
    }

    if (action === 'deny') {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.admin.deleteUser(userId);
        return new NextResponse('Usuario eliminado.', { status: 200 });
    }
}