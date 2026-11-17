import { businessConfig } from "@/lib/business-config";

const SOUND_KEY = "lumiere-sound";

let audioCtx: AudioContext | null = null;
let flashTimer: number | null = null;
let titleBeforeFlash = "";
let removeFocusListener: (() => void) | null = null;

export function readSoundPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_KEY) !== "off";
}

export function writeSoundPreference(on: boolean): void {
  window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

export function beep(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = audioCtx ?? new AudioCtor();
    [880, 660, 880].forEach((frequency, index) => {
      const oscillator = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(audioCtx!.destination);
      gain.gain.setValueAtTime(0.2, audioCtx!.currentTime + index * 0.25);
      oscillator.start(audioCtx!.currentTime + index * 0.25);
      oscillator.stop(audioCtx!.currentTime + index * 0.25 + 0.18);
    });
  } catch {
    // Audio is best-effort; browsers can block it before a user gesture.
  }
}

export function requestNotificationPermission(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function notifyNewHandoff(names: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(`${businessConfig.name}: new handoff`, { body: names });
  }
}

export function flashTitle(): void {
  if (typeof document === "undefined") return;
  if (flashTimer !== null) window.clearInterval(flashTimer);
  if (!titleBeforeFlash) titleBeforeFlash = document.title;
  let on = false;
  flashTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? "🚨 New handoff!" : titleBeforeFlash;
  }, 1000);

  removeFocusListener?.();
  const onFocus = () => stopTitleFlash();
  window.addEventListener("focus", onFocus, { once: true });
  removeFocusListener = () => window.removeEventListener("focus", onFocus);
}

export function stopTitleFlash(): void {
  if (typeof window === "undefined") return;
  if (flashTimer !== null) {
    window.clearInterval(flashTimer);
    flashTimer = null;
  }
  if (titleBeforeFlash) {
    document.title = titleBeforeFlash;
    titleBeforeFlash = "";
  }
  removeFocusListener?.();
  removeFocusListener = null;
}
