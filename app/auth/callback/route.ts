import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resend } from "@/lib/resend/client";
import { cookies } from "next/headers";
import crypto from "crypto";

function signToken(userId: string): string {
    return crypto
        .createHmac('sha256', process.env.APPROVAL_SECRET!)
        .update(userId)
        .digest('hex');
}

export async function GET(req: NextRequest){
    const {searchParams, origin} = new URL(req.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
        const cookieStore =  await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({name,value,options})=>
                            cookieStore.set(name,value,options)
                        );
                    },
                },
            }
        );

        const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('status, email, full_name, created_at')
                .eq('id', user.id)
                .single();

            if (profile?.status === 'pending') {
                const ageMs = Date.now() - new Date(profile.created_at).getTime();
                const isNew = ageMs < 2 * 60 * 1000;

                if (isNew) {
                    const token = signToken(user.id);
                    const base = process.env.NEXT_PUBLIC_APP_URL;
                    const approveUrl = `${base}/api/admin/action?userId=${user.id}&token=${token}&action=approve`;
                    const denyUrl    = `${base}/api/admin/action?userId=${user.id}&token=${token}&action=deny`;

                    await resend.emails.send({
                        from: 'Boletera <onboarding@resend.dev>',
                        to: process.env.ADMIN_EMAIL!,
                        subject: 'Nueva solicitud de acceso — Boletera',
                        html: `
                        <h2>Nueva solicitud de acceso</h2>
                        <p><strong>Nombre:</strong> ${profile.full_name ?? '—'}</p>
                        <p><strong>Email:</strong> ${profile.email}</p>
                        <p>
                          <a href="${approveUrl}">Aceptar</a> &nbsp;|&nbsp;
                          <a href="${denyUrl}">Rechazar</a>
                        </p>`,
                    });
                }

                return NextResponse.redirect(`${origin}/pending`);
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}