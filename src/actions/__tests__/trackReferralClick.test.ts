import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase insert chain
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockGetUser = vi.fn();

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Import after mocking
import { trackReferralClick } from '../trackReferralClick';

describe('trackReferralClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts row with correct user_id, pin_id, platform_name for authenticated user', async () => {
    const userId = 'user-abc-123';
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
    mockInsert.mockResolvedValue({ error: null });

    const result = await trackReferralClick({
      pinId: 'pin-456',
      platformName: 'booking.com',
    });

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith('referral_clicks');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: userId,
      pin_id: 'pin-456',
      platform_name: 'booking.com',
    });
  });

  it('inserts row with null user_id for anonymous user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInsert.mockResolvedValue({ error: null });

    const result = await trackReferralClick({
      pinId: 'pin-789',
      platformName: 'klook',
    });

    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: null,
      pin_id: 'pin-789',
      platform_name: 'klook',
    });
  });

  it('returns { success: false } without throwing when insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockResolvedValue({ error: { message: 'RLS violation' } });

    const result = await trackReferralClick({
      pinId: 'pin-000',
      platformName: 'tripadvisor',
    });

    expect(result).toEqual({ success: false });
  });

  it('returns { success: false } without throwing on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Network failure'));

    const result = await trackReferralClick({
      pinId: 'pin-err',
      platformName: 'booking.com',
    });

    expect(result).toEqual({ success: false });
  });
});
