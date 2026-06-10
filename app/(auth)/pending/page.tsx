'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (!profile || profile.status !== 'pending') {
        router.push('/');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitud enviada</h1>
        <p className="text-sm text-gray-500">
          Tu cuenta está pendiente de aprobación. Te avisaremos cuando sea activada.
        </p>
      </div>
    </div>
  );
}
