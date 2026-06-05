/**
 * Determines if a lunch break is required.
 * 
 * Rule: Preference for 13:00-14:00. 
 * If the docente/group has classes before AND after the 12:00-14:00 window,
 * they MUST have at least 1 hour free in that window.
 */
export function getLunchBlockedHoras(scheduledHoras: string[]): string[] {
  // Sort and filter morning hours (before the lunch window, i.e., < 13:00)
  const morningHoras = scheduledHoras.filter(h => h < '13:00').sort();
  const maxContinuousMorning = countContinuousHours(morningHoras);

  if (maxContinuousMorning >= 4) {
    if (!scheduledHoras.includes('12:00')) {
      return ['12:00'];
    }
    if (!scheduledHoras.includes('13:00')) {
      return ['13:00'];
    }
  }

  return [];
}

/**
 * Counts the longest run of continuous hours in a sorted array.
 * Hours are continuous if they increment by 1 hour each.
 */
function countContinuousHours(sortedHoras: string[]): number {
  if (sortedHoras.length === 0) return 0;

  let maxRun = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedHoras.length; i++) {
    const prevHour = parseInt(sortedHoras[i - 1].split(':')[0], 10);
    const currHour = parseInt(sortedHoras[i].split(':')[0], 10);

    if (currHour === prevHour + 1) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  return maxRun;
}
