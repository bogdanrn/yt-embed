export class IframeApiLoadError extends Error {
  override name = 'IframeApiLoadError';
}

export class PlayerInitError extends Error {
  override name = 'PlayerInitError';
}

export class PlayerDestroyedError extends Error {
  override name = 'PlayerDestroyedError';
}
