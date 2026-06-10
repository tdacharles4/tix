import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';
import crypto from 'crypto';
import { create } from "domain";

const resend = new Resend(process.env.RESEND_API_KEY);

function signToken(userId: string): string {
    return crypto
        .createHmac('sha256', process.env.APPROVAL_SECRET!)
        .update(userId)
        .digest('hex');
}

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const since = new Date(Date.now()-24*60*60*1000).toISOString();

    const { data: pending } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .eq('status', 'pending')
        .gte('created_at', since);

    if (!pending || pending.length === 0) {
        return NextResponse.json({sent:false});
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    const rows = pending.map((u)=>{
        const token = signToken(u.id);
        const approveUrl = `${baseUrl}/api/admin/action?userId=${u.id}&token=${token}&action=approve`;
        const denyUrl    = `${baseUrl}/api/admin/action?userId=${u.id}&token=${token}&action=deny`;
        return `
        <tr>
          <td>${u.full_name ?? '—'}</td>
          <td>${u.email}</td>
          <td><a href="${approveUrl}">Aceptar</a></td>
          <td><a href="${denyUrl}">Rechazar</a></td>
        </tr>`;
    }).join('');

    await resend.emails.send({
        from: 'Boletera <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL!,
        subject: `${pending.length} solicitud(es) pendiente(s) — Boletera`,
        html: `
        <h2>Solicitudes de acceso del día</h2>
        <table border="1" cellpadding="8">
            <thead><tr><th>Nombre</th><th>Email</th><th>Acción</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`,
    });

    return NextResponse.json({ sent: true, count: pending.length });
}

