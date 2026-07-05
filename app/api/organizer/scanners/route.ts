import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/scanner/password';

// GET — list scanner accounts for the logged-in organizer
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceClient();
  const { data: scanners } = await admin
    .from('scanner_accounts')
    .select('id, username, created_at')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ scanners: scanners ?? [] });
}

// POST — create a new scanner account
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  // Validate username: 3–30 chars, alphanumeric + underscores only
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: 'El usuario debe tener 3–30 caracteres (letras, números y _)' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres' },
      { status: 400 },
    );
  }

  const password_hash = await hashPassword(password);
  const admin = createServiceClient();

  const { data, error } = await admin
    .from('scanner_accounts')
    .insert({ organizer_id: user.id, username, password_hash })
    .select('id, username, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un escáner con ese nombre de usuario' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scanner: data }, { status: 201 });
}
