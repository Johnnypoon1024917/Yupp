'use client';

import { useState, useEffect } from 'react';

export interface WeatherData {
  tempHigh: number;
  tempLow: number;
  weatherCode: number;
  icon: string;
}

/**
 * Maps WMO weather codes to emoji icons.
 * @see https://open-meteo.com/en/docs#weathervariables
 */
export function weatherCodeToIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '☀️'; // fallback for unknown codes
}

/**
 * Checks whether a target date string (YYYY-MM-DD) falls within
 * the next 7 days from today (inclusive of today).
 */
function isWithin7Days(targetDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate + 'T00:00:00');
  if (isNaN(target.getTime())) return false;

  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays < 7;
}

/**
 * Fetches weather forecast data from Open-Meteo for a given location and date.
 * Returns null if the date is outside the 7-day forecast window or on error.
 */
export function useWeather(
  lat: number | null,
  lng: number | null,
  targetDate: string | null
): { data: WeatherData | null; isLoading: boolean } {
  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null || !targetDate || !isWithin7Days(targetDate)) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: {
        daily: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
        };
      }) => {
        if (controller.signal.aborted) return;

        const dayIndex = json.daily.time.indexOf(targetDate);
        if (dayIndex === -1) {
          setData(null);
        } else {
          const code = json.daily.weather_code[dayIndex];
          setData({
            tempHigh: json.daily.temperature_2m_max[dayIndex],
            tempLow: json.daily.temperature_2m_min[dayIndex],
            weatherCode: code,
            icon: weatherCodeToIcon(code),
          });
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Silent failure — return null
        setData(null);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [lat, lng, targetDate]);

  return { data, isLoading };
}
