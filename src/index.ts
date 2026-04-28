export {
  EnvironmentError,
  IframeApiLoadError,
  PlayerDestroyedError,
  PlayerInitError,
} from './errors.js';
export type { EventCallbackName } from './eventCallbackNames.generated.js';
export {
  type AbLoopExtensionOptions,
  abLoopExtension,
} from './extensions/abLoop.js';
export {
  type AnalyticsEvent,
  type AnalyticsExtensionOptions,
  analyticsExtension,
} from './extensions/analytics.js';
export {
  type AutoplayPolicyExtensionOptions,
  autoplayPolicyExtension,
} from './extensions/autoplayPolicy.js';
export {
  type BufferProgressExtensionOptions,
  bufferProgressExtension,
} from './extensions/bufferProgress.js';
export {
  type CaptionsLanguageExtensionOptions,
  captionsLanguageExtension,
} from './extensions/captionsLanguage.js';
export {
  type Chapter,
  type ChapterChangeExtensionOptions,
  chapterChangeExtension,
} from './extensions/chapterChange.js';
export {
  type CuePoint,
  type CuePointExtensionOptions,
  cuePointExtension,
} from './extensions/cuePoint.js';
export {
  type DurationChangeExtensionOptions,
  durationChangeExtension,
} from './extensions/durationChange.js';
export {
  type ErrorRetryExtensionOptions,
  errorRetryExtension,
} from './extensions/errorRetry.js';
export {
  type FullscreenExtensionOptions,
  fullscreenExtension,
} from './extensions/fullscreen.js';
export { headlessAudioExtension } from './extensions/headlessAudio.js';
export {
  type MediaSessionExtensionOptions,
  mediaSessionExtension,
} from './extensions/mediaSession.js';
export {
  type PersistedStateExtensionOptions,
  persistedStateExtension,
  type StorageLike,
} from './extensions/persistedState.js';
export { pictureInPictureExtension } from './extensions/pictureInPicture.js';
export { playbackRateOptimisticExtension } from './extensions/playbackRateOptimistic.js';
export {
  type ScrubBarSyncExtensionOptions,
  scrubBarSyncExtension,
} from './extensions/scrubBarSync.js';
export {
  type SeekRangeExtensionOptions,
  seekRangeExtension,
} from './extensions/seekRange.js';
export {
  type TimeUpdateExtensionOptions,
  timeUpdateExtension,
} from './extensions/timeUpdate.js';
export {
  type VisibilityChangeExtensionOptions,
  visibilityChangeExtension,
} from './extensions/visibilityChange.js';
export {
  type VolumeChangeExtensionOptions,
  volumeChangeExtension,
} from './extensions/volumeChange.js';
export type { FunctionName } from './functionNames.generated.js';
export { config as ytEmbedConfig, type YTEmbedConfig } from './loadIframeApi.js';
export { YouTubeErrorCode, youTubeErrorMessageFor } from './playerErrors.js';
export { PlayerState, type PlayerStateCode } from './playerState.js';
export type {
  Extension,
  MethodCallOptions,
  PlayerVars,
  YTEmbedEventMap,
  YTEmbedOptions,
} from './types.js';
export { YTEmbed } from './YTEmbed.js';
