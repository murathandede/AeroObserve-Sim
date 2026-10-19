/** Presentation cadence only: these values do not describe sensor FPS. */
export const presentationSpeeds = [.5, 1, 2] as const;

export function isPresentationSpeed(value: number): boolean {
  return presentationSpeeds.some(speed => speed === value);
}

export function isApiPosition(index: number, count: number): boolean {
  return Number.isInteger(count) && count > 0 && Number.isInteger(index) && index >= 0 && index < count;
}

export interface PlaybackAvailability {
  navigable: boolean;
  previous: boolean;
  next: boolean;
  play: boolean;
  pause: boolean;
}

/** Shared guards for the existing hook and its controls, without owning any state. */
export function playbackAvailability(opened: boolean, count: number, index: number, loading: boolean, failed: boolean, playing: boolean): PlaybackAvailability {
  const navigable = opened && !failed && isApiPosition(index, count);
  return {
    navigable,
    previous: navigable && index > 0,
    next: navigable && index < count - 1,
    play: navigable && !loading && index < count - 1,
    pause: opened && playing,
  };
}
