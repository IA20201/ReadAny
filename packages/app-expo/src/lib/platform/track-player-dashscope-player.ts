import { getPlatformService } from "@readany/core/services/platform";
import type { ITTSPlayer, TTSConfig } from "@readany/core/tts";
import { splitIntoChunks } from "@readany/core/tts";
import { File, Paths } from "expo-file-system";
import { Image } from "react-native";
import TrackPlayer, { Event, State } from "react-native-track-player";

const CHUNK_MAX_CHARS = 500;
const DEFAULT_ARTWORK = Image.resolveAssetSource(require("../../assets/icon.png")).uri;

export class TrackPlayerDashScopeTTSPlayer implements ITTSPlayer {
  onStateChange?: (state: "playing" | "paused" | "stopped") => void;
  onChunkChange?: (index: number, total: number) => void;
  onEnd?: () => void;

  private _stopped = false;
  private _paused = false;
  private _chunks: string[] = [];
  private _currentIndex = 0;
  private _config: TTSConfig | null = null;
  private _tempFiles: string[] = [];
  private _speakGen = 0;
  private _unsubscribers: (() => void)[] = [];
  private _downloadComplete = false;
  private _getArtwork: (() => string | undefined) | null = null;
  private _retryCount = 0;
  private static readonly MAX_RETRIES = 3;

  setArtworkGetter(getter: () => string | undefined): void {
    this._getArtwork = getter;
  }

  async speak(text: string | string[], config: TTSConfig): Promise<void> {
    const gen = ++this._speakGen;
    await this._cleanup();
    if (gen !== this._speakGen) return;

    if (!config.dashscopeApiKey) {
      console.warn("[TrackPlayerDashScopeTTSPlayer] No API key provided");
      this.onStateChange?.("stopped");
      this.onEnd?.();
      return;
    }

    this._stopped = false;
    this._paused = false;
    this._config = config;
    this._downloadComplete = false;
    this._retryCount = 0;
    this._chunks = Array.isArray(text)
      ? text.filter(Boolean)
      : splitIntoChunks(text, CHUNK_MAX_CHARS);
    this._currentIndex = 0;
    this._tempFiles = [];

    if (this._chunks.length === 0) {
      this.onStateChange?.("stopped");
      this.onEnd?.();
      return;
    }

    this.onStateChange?.("playing");

    await TrackPlayer.reset();

    this._subscribeToEvents(gen);

    this._downloadAndPlay(gen);
  }

  private _subscribeToEvents(gen: number): void {
    for (const unsub of this._unsubscribers) unsub();
    this._unsubscribers = [];

    const unsubTrackChange = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      (event) => {
        if (gen !== this._speakGen || this._stopped) return;
        if (event.index != null && event.index >= 0) {
          this._currentIndex = event.index;
          this.onChunkChange?.(event.index, this._chunks.length);
        }
      },
    );

    const unsubStateChange = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      if (gen !== this._speakGen || this._stopped) return;
      if (event.state === State.Playing) {
        this.onStateChange?.("playing");
      } else if (event.state === State.Paused) {
        this.onStateChange?.("paused");
      } else if (event.state === State.Error) {
        if (this._retryCount < TrackPlayerDashScopeTTSPlayer.MAX_RETRIES) {
          this._retryCount++;
          console.warn(
            `[TrackPlayerDashScopeTTSPlayer] playback error, retry ${this._retryCount}/${TrackPlayerDashScopeTTSPlayer.MAX_RETRIES}`,
          );
          TrackPlayer.retry().catch(() => {});
        } else {
          console.error("[TrackPlayerDashScopeTTSPlayer] playback error, max retries reached");
          this._stopped = true;
          this.onStateChange?.("stopped");
        }
      }
    });

    const unsubQueueEnded = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      if (gen !== this._speakGen || this._stopped) return;
      if (!this._downloadComplete) return;
      this._stopped = true;
      this.onStateChange?.("stopped");
      this.onEnd?.();
    });

    const unsubSeek = TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      if (gen !== this._speakGen || this._stopped) return;
      TrackPlayer.seekTo(event.position);
    });

    this._unsubscribers.push(
      unsubTrackChange.remove,
      unsubStateChange.remove,
      unsubQueueEnded.remove,
      unsubSeek.remove,
    );
  }

  private async _downloadAndPlay(gen: number): Promise<void> {
    try {
      const artwork = this._getArtwork?.() || DEFAULT_ARTWORK;

      for (let i = 0; i < this._chunks.length; i++) {
        if (gen !== this._speakGen || this._stopped) return;

        const audioUri = await this._fetchChunkFile(i, gen);
        if (gen !== this._speakGen || this._stopped) return;

        await TrackPlayer.add({
          id: `tts-dashscope-${i}`,
          url: audioUri,
          title: `Segment ${i + 1}`,
          artwork,
        });

        if (i === 0) {
          await TrackPlayer.play();
        }
      }

      if (gen !== this._speakGen || this._stopped) return;
      this._downloadComplete = true;

      const queue = await TrackPlayer.getQueue();
      if (queue.length === 0) {
        this._stopped = true;
        this.onStateChange?.("stopped");
        this.onEnd?.();
      }
    } catch (err) {
      if (!this._stopped && (err as Error)?.message !== "aborted") {
        console.error("[TrackPlayerDashScopeTTSPlayer] download error:", err);
      }
    }
  }

  private async _fetchChunkFile(index: number, gen: number): Promise<string> {
    if (this._stopped || gen !== this._speakGen || !this._config) throw new Error("aborted");

    const config = this._config;
    const platform = getPlatformService();

    const response = await platform.fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.dashscopeApiKey}`,
        },
        body: JSON.stringify({
          model: "qwen3-tts-flash",
          input: {
            text: this._chunks[index],
            voice: config.dashscopeVoice,
          },
          parameters: {
            response_format: "mp3",
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`DashScope TTS failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      output?: { audio?: { data?: string } };
    };
    const audioData = result?.output?.audio?.data;
    if (!audioData) {
      throw new Error("No audio data in DashScope response");
    }

    if (this._stopped || gen !== this._speakGen) throw new Error("aborted");

    const binary = atob(audioData);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j);
    }

    const tmpName = `tts_dashscope_${index}_${Date.now()}.mp3`;
    const tmpFile = new File(Paths.cache, tmpName);
    const audioUri = tmpFile.uri;
    this._tempFiles.push(audioUri);
    tmpFile.write(bytes);
    return audioUri;
  }

  pause(): void {
    if (this._stopped || this._paused) return;
    this._paused = true;
    TrackPlayer.pause();
    this.onStateChange?.("paused");
  }

  resume(): void {
    if (this._stopped || !this._paused) return;
    this._paused = false;
    TrackPlayer.play();
    this.onStateChange?.("playing");
  }

  stop(): void {
    this._stopped = true;
    this._paused = false;
    this._downloadComplete = false;
    TrackPlayer.stop();
    TrackPlayer.reset();
    this._cleanupEvents();
    this._cleanupTempFiles();
    this.onStateChange?.("stopped");
  }

  private async _cleanup(): Promise<void> {
    this._stopped = true;
    this._downloadComplete = false;
    this._cleanupEvents();
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
    } catch {}
    this._cleanupTempFiles();
  }

  private _cleanupEvents(): void {
    for (const unsub of this._unsubscribers) unsub();
    this._unsubscribers = [];
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
