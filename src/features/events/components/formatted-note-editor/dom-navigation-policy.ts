export type DOMNavigationRequest = Readonly<{
  url: string;
  isTopFrame?: boolean;
  navigationType?: string;
}>;

/** Nativeが読み込ませたeditor document以外へのtop-level遷移を拒否する。 */
export type DOMNavigationPolicy = Readonly<{
  seedDocumentUrl(url: string): void;
  shouldStart(request: DOMNavigationRequest): boolean;
}>;

export function createDOMNavigationPolicy(
  allowFirstTopFrameRequest = false,
): DOMNavigationPolicy {
  let editorDocumentUrl: string | null = null;
  return {
    seedDocumentUrl(url) {
      if (editorDocumentUrl === null && url.length > 0) editorDocumentUrl = url;
    },
    shouldStart(request) {
      if (request.isTopFrame === false) return true;
      if (request.url.length === 0) return false;
      if (editorDocumentUrl === null && allowFirstTopFrameRequest) {
        editorDocumentUrl = request.url;
        return true;
      }
      return request.url === editorDocumentUrl;
    },
  };
}
