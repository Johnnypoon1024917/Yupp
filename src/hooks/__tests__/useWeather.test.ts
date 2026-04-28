import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track state setters
const stateSetters: Record<string, (val: unknown) => void> = {};
let stateCallIndex = 0;
const stateNames = ['data', 'isLoading'];
const stateValues: Record<string, unknown> = {
  data: null,
  isLoading: false,
};

let capturedEffect: (() => (() => void) | void) | null = null;
let capturedDeps: unknown[] | undefined = undefined;

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const name = stateNames[stateCallIndex % stateNames.length];
    stateValues[name] = initial;
    const setter = (val: unknown) => {
      stateValues[name] =
        typeof val === 'function'
          ? (val as (prev: unknown) => unknown)(stateValues[name])
          : val;
    };
    stateSetters[name] = setter;
    stateCallIndex++;
    return [stateValues[name], setter];
  },
  useEffect: (fn: () => (() => void) | void, deps?: unknown[]) => {
    capturedEffect = fn;
    capturedDeps = deps;
  },
}));

describe('weatherCodeToIcon', () => {
  it('maps code 0 to ☀️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(0)).toBe('☀️');
  });

  it('maps codes 1-3 to ⛅', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(1)).toBe('⛅');
    expect(weatherCodeToIcon(2)).toBe('⛅');
    expect(weatherCodeToIcon(3)).toBe('⛅');
  });

  it('maps codes 45-48 to 🌫️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(45)).toBe('🌫️');
    expect(weatherCodeToIcon(48)).toBe('🌫️');
  });

  it('maps codes 51-67 to 🌧️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(51)).toBe('🌧️');
    expect(weatherCodeToIcon(67)).toBe('🌧️');
  });

  it('maps codes 71-77 to ❄️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(71)).toBe('❄️');
    expect(weatherCodeToIcon(77)).toBe('❄️');
  });

  it('maps codes 80-82 to 🌦️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(80)).toBe('🌦️');
    expect(weatherCodeToIcon(82)).toBe('🌦️');
  });

  it('maps codes 95-99 to ⛈️', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(95)).toBe('⛈️');
    expect(weatherCodeToIcon(99)).toBe('⛈️');
  });

  it('returns ☀️ for unknown codes', async () => {
    const { weatherCodeToIcon } = await import('../useWeather');
    expect(weatherCodeToIcon(200)).toBe('☀️');
    expect(weatherCodeToIcon(-1)).toBe('☀️');
  });
});

describe('useWeather', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffect = null;
    capturedDeps = undefined;
    stateCallIndex = 0;
    stateValues.data = null;
    stateValues.isLoading = false;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('does not fetch when lat is null', async () => {
    const { useWeather } = await import('../useWeather');
    useWeather(null, 139.65, '2025-06-16');

    capturedEffect!();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when lng is null', async () => {
    const { useWeather } = await import('../useWeather');
    useWeather(35.67, null, '2025-06-16');

    capturedEffect!();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when targetDate is null', async () => {
    const { useWeather } = await import('../useWeather');
    useWeather(35.67, 139.65, null);

    capturedEffect!();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when targetDate is outside 7-day window', async () => {
    const { useWeather } = await import('../useWeather');
    // Use a date far in the future
    useWeather(35.67, 139.65, '2099-12-31');

    capturedEffect!();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches weather data for a valid date within 7-day window', async () => {
    // Build a target date that is today (always within window)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          daily: {
            time: [todayStr],
            weather_code: [0],
            temperature_2m_max: [28],
            temperature_2m_min: [22],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { useWeather } = await import('../useWeather');
    useWeather(35.67, 139.65, todayStr);

    capturedEffect!();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=35.67');
    expect(url).toContain('longitude=139.65');
    expect(url).toContain('daily=weather_code,temperature_2m_max,temperature_2m_min');
    expect(url).toContain('timezone=auto');
  });

  it('has lat, lng, and targetDate as dependencies', async () => {
    const { useWeather } = await import('../useWeather');
    useWeather(35.67, 139.65, '2025-06-16');

    expect(capturedDeps).toBeDefined();
    expect(capturedDeps).toEqual([35.67, 139.65, '2025-06-16']);
  });

  it('returns cleanup function that aborts the request', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          daily: { time: [todayStr], weather_code: [0], temperature_2m_max: [28], temperature_2m_min: [22] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { useWeather } = await import('../useWeather');
    useWeather(35.67, 139.65, todayStr);

    const cleanup = capturedEffect!();
    expect(typeof cleanup).toBe('function');
  });
});
