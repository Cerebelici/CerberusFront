import { useState, useEffect } from 'react';

// Format milliseconds into DDD:HH:MM:SS
function formatUptime(ms: number): string {
  if (ms < 0) ms = 0;
  
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const pad = (num: number, size = 2) => String(num).padStart(size, '0');

  return `${pad(days, 3)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function useUptime(startTimeIsoOrTimestamp?: string | number | null) {
  const [formattedUptime, setFormattedUptime] = useState<string>('000:00:00:00');

  useEffect(() => {
    if (!startTimeIsoOrTimestamp) return;
    const startTime = new Date(startTimeIsoOrTimestamp).getTime();
    if (Number.isNaN(startTime)) return;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      setFormattedUptime(formatUptime(elapsed));
    };

    updateTimer();

    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [startTimeIsoOrTimestamp]);

  return formattedUptime;
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  
  const pad = (num: number) => String(num).padStart(2, '0');

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = String(date.getFullYear()).slice(-2);
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}