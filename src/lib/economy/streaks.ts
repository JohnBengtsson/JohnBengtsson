// Dates are passed as ISO strings (YYYY-MM-DD) so this function is pure
// with no side effects and no calls to Date.now().
export function isStreakAlive(
  lastLoggedDate: string | null,
  today: string
): boolean {
  if (!lastLoggedDate) return false;

  const last = new Date(lastLoggedDate);
  const todayDate = new Date(today);
  const diffMs = todayDate.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays <= 1;
}
