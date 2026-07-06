import { useCallback, useEffect, useRef } from 'react';
import { useEditor } from '../state/store';
import { showEndMs } from '../state/interpolate';
import { audioDurationMs, getAudioElement } from '../audio/audioPlayer';

function playbackEndMs(): number {
  return Math.max(showEndMs(useEditor.getState().formations), audioDurationMs());
}

/**
 * Drives the playhead. With audio loaded the audio element is the clock
 * (keeps formations in sync with what the room hears); without audio a
 * requestAnimationFrame timer runs the show alone.
 */
export function usePlayback(): { togglePlay: () => void } {
  const isPlaying = useEditor((s) => s.isPlaying);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) return;

    const audio = getAudioElement();
    const endMs = playbackEndMs();
    const startState = useEditor.getState();
    if (audio !== null) {
      audio.currentTime = startState.playheadMs / 1000;
      audio.playbackRate = startState.playbackRate;
      void audio.play();
    }
    let lastTick = window.performance.now();

    const tick = (now: number): void => {
      const s = useEditor.getState();
      // With audio, the audio element is the clock and carries the rate
      // (kept in sync here so mid-playback speed changes take effect).
      if (audio !== null && audio.playbackRate !== s.playbackRate) {
        audio.playbackRate = s.playbackRate;
      }
      const t =
        audio !== null
          ? audio.currentTime * 1000
          : s.playheadMs + (now - lastTick) * s.playbackRate;
      lastTick = now;
      if (t >= endMs || (audio !== null && audio.ended)) {
        s.setPlayhead(endMs);
        s.setIsPlaying(false);
        return;
      }
      s.setPlayhead(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audio !== null) audio.pause();
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const s = useEditor.getState();
    if (s.isPlaying) {
      s.setIsPlaying(false);
      return;
    }
    const endMs = playbackEndMs();
    if (endMs <= 0) return;
    if (s.playheadMs >= endMs - 10) s.setPlayhead(0);
    s.setIsPlaying(true);
  }, []);

  return { togglePlay };
}
