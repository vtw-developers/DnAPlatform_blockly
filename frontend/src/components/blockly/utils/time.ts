export const formatElapsedTime = (seconds: number): string => {
  if (seconds < 0) return '0초';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes > 0 ? `${minutes}분 ` : ''}${remainingSeconds}초`;
}; 