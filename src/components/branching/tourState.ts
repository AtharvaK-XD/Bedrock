/** Remembers (in this browser only) that the Branching tour has been seen. */

export const TOUR_STORAGE_KEY = 'bedrock_branching_tour_done';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return true; // storage blocked: do not nag on every visit
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // ignore: the tour simply shows again next time
  }
}

export function resetTourSeen(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
