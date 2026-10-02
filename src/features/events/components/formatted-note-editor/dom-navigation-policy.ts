export type DOMNavigationRequest = Readonly<{
  url: string;
  isTopFrame?: boolean;
  navigationType?: string;
}>;

/** Nativeが読み込ませたeditor document以外へのtop-level遷移を拒否する。 */
export function createDOMNavigationPolicy(): (request: DOMNavigationRequest) => boolean {
  let editorDocumentUrl: string | null = null;
  return (request) => {
    if (request.isTopFrame === false) return true;
    if (request.url.length === 0) return false;
    if (editorDocumentUrl === null) {
      editorDocumentUrl = request.url;
      return true;
    }
    return request.url === editorDocumentUrl;
  };
}
