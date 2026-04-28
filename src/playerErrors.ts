export enum YouTubeErrorCode {
  InvalidParam = 2,
  Html5Error = 5,
  VideoNotFound = 100,
  EmbeddingNotAllowed = 101,
  EmbeddingNotAllowed2 = 150,
}

export const youTubeErrorMessages: Readonly<Record<YouTubeErrorCode, string>> = {
  [YouTubeErrorCode.InvalidParam]: 'Invalid parameter passed to the YouTube player.',
  [YouTubeErrorCode.Html5Error]: 'The HTML5 player encountered an error.',
  [YouTubeErrorCode.VideoNotFound]: 'The requested video was not found.',
  [YouTubeErrorCode.EmbeddingNotAllowed]: 'Embedding is disabled for this video by the owner.',
  [YouTubeErrorCode.EmbeddingNotAllowed2]: 'Embedding is disabled for this video (variant of 101).',
};

export function youTubeErrorMessageFor(code: number): string {
  return youTubeErrorMessages[code as YouTubeErrorCode] ?? `YT error ${code}`;
}
