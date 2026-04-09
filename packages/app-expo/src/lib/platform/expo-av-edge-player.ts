/**
 * ExpoAVEdgeTTSPlayer — ITTSPlayer backed by expo-av + Edge TTS WebSocket API.
 *
 * Fetch MP3 chunks from Microsoft Edge TTS → write to temp files → play
 * sequentially via expo-av Audio.Sound with background audio enabled.
 *
 * Background audio is enabled via Audio.setAudioModeAsync called at app
 * startup (see App.tsx). This player just manages playback.
 */
import { Audio } from "expo-av";
import { File, Paths } from "expo-file-system";
import type { ITTSPlayer, TTSConfig } from "@readany/core/tts";
import { fetchEdgeTTSAudio } from "@readany/core/tts";
import { splitIntoChunks } from "@readany/core/tts";

const CHUNK_MAX_CHARS = 500;

export class ExpoAVEdgeTTSPlayer implements ITTSPlayer {
  onStateChange?: (state: "playing" | "paused" | "stopped") => void;
  onChunkChange?: (index: number, total: number) => void;
  onEnd?: () => void;

  private _stopped = false;
  private _paused = false;
  private _currentSound: Audio.Sound | null = null;
  private _chunks: string[] = [];
  private _currentIndex = 0;
  private _config: TTSConfig | null = null;
  private _tempFiles: string[] = [];

  async speak(text: string | string[], config: TTSConfig): Promise<void> {
    await this._cleanup();
    this._stopped = false;
    this._paused = false;
    this._config = config;
    this._chunks = Array.isArray(text) ? text.filter(Boolean) : splitIntoChunks(text, CHUNK_MAX_CHARS);
    this._currentIndex = 0;
    this._tempFiles = [];

    this.onStateChange?.("playing");
    await this._playChunk();
  }

  private async _playChunk(): Promise<void> {
    if (this._stopped || this._currentIndex >= this._chunks.length) {
      if (!this._stopped) {
        this._stopped = true;
        this.onStateChange?.("stopped");
        this.onEnd?.();
      }
      return;
    }

    const idx = this._currentIndex;
    const chunk = this._chunks[idx];
    const config = this._config!;
    this.onChunkChange?.(idx, this._chunks.length);

    let audioUri: string | null = null;
    try {
      const voice = config.edgeVoice || "zh-CN-XiaoxiaoNeural";
      const lang = voice.split("-").slice(0, 2).join("-");

      const mp3Data = await fetchEdgeTTSAudio({
        text: chunk,
        voice,
        lang,
        rate: config.rate,
        pitch: config.pitch,
      });

      if (this._stopped) return;

      // Write MP3 to a temp file so expo-av can load it
      const tmpName = `tts_chunk_${idx}_${Date.now()}.mp3`;
      const tmpFile = new File(Paths.cache, tmpName);
      audioUri = tmpFile.uri;
      this._tempFiles.push(audioUri);

      tmpFile.write(new Uint8Array(mp3Data));

      if (this._stopped) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: !this._paused, rate: 1.0, shouldCorrectPitch: false },
      );
      this._currentSound = sound;

      if (this._paused) {
        // Created but not playing; wait for resume
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (this._stopped) {
              clearInterval(checkInterval);
              resolve();
            } else if (!this._paused) {
              clearInterval(checkInterval);
              sound.playAsync().then(() => resolve());
            }
          }, 100);
        });
        if (this._stopped) {
          await sound.unloadAsync().catch(() => {});
          return;
        }
      }

      await new Promise<void>((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            if ((status as any).error) {
              reject(new Error((status as any).error));
            }
            return;
          }
          if (status.didJustFinish) {
            resolve();
          }
        });
      });

      await sound.unloadAsync().catch(() => {});
      this._currentSound = null;

      this._currentIndex++;
      if (!this._stopped) {
        await this._playChunk();
      }
    } catch (err) {
      console.error("[ExpoAVEdgeTTSPlayer] chunk error:", err);
      if (this._currentSound) {
        await this._currentSound.unloadAsync().catch(() => {});
        this._currentSound = null;
      }
      this._currentIndex++;
      if (!this._stopped) {
        await this._playChunk();
      }
    } finally {
      // Clean up temp file
      if (audioUri) {
        try {
          const f = new File(audioUri);
          if (f.exists) f.delete();
        } catch {}
      }
    }
  }

  pause(): void {
    if (this._stopped || this._paused) return;
    this._paused = true;
    this._currentSound?.pauseAsync().catch(() => {});
    this.onStateChange?.("paused");
  }

  resume(): void {
    if (this._stopped || !this._paused) return;
    this._paused = false;
    this._currentSound?.playAsync().catch(() => {});
    this.onStateChange?.("playing");
  }

  stop(): void {
    this._stopped = true;
    this._currentSound?.stopAsync().catch(() => {});
    this._currentSound?.unloadAsync().catch(() => {});
    this._currentSound = null;
    this._cleanupTempFiles();
    this.onStateChange?.("stopped");
  }

  private async _cleanup(): Promise<void> {
    this._stopped = true;
    if (this._currentSound) {
      await this._currentSound.stopAsync().catch(() => {});
      await this._currentSound.unloadAsync().catch(() => {});
      this._currentSound = null;
    }
    this._cleanupTempFiles();
  }

  private _cleanupTempFiles(): void {
    for (const f of this._tempFiles) {
      try {
        const file = new File(f);
        if (file.exists) file.delete();
      } catch {}
    }
    this._tempFiles = [];
  }
}
