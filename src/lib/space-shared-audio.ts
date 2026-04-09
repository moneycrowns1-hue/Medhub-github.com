let sharedSpaceAudio: HTMLAudioElement | null = null;

export function getSpaceSharedAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedSpaceAudio) {
    sharedSpaceAudio = new Audio();
    sharedSpaceAudio.preload = "auto";
  }
  return sharedSpaceAudio;
}
