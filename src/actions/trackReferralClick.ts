'use server';

import { createClient } from '@/utils/supabase/server';

export async function trackReferralClick(params: {
  pinId: string;
  platformName: string;
}): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('referral_clicks').insert({
      user_id: user?.id ?? null,
      pin_id: params.pinId,
      platform_name: params.platformName,
    });

    if (error) {
      console.error('[trackReferralClick] Insert failed:', error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error('[trackReferralClick] Unexpected error:', err);
    return { success: false };
  }
}
