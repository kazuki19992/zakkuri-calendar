import { createDOMNavigationPolicy } from '../dom-navigation-policy';

describe('メモDOMのnavigation policy', () => {
  test('nativeが指定した最初のdocumentと同じURLだけをtop frameに許可する', () => {
    const shouldStart = createDOMNavigationPolicy();

    expect(shouldStart({ url: 'file:///editor/index.html', isTopFrame: true })).toBe(true);
    expect(shouldStart({ url: 'file:///editor/index.html', isTopFrame: true })).toBe(true);
    expect(shouldStart({ url: 'https://example.com/', isTopFrame: true })).toBe(false);
    expect(shouldStart({ url: 'https://example.com/redirect', isTopFrame: true,
      navigationType: 'other' })).toBe(false);
    expect(shouldStart({ url: 'https://example.com/click', isTopFrame: true,
      navigationType: undefined })).toBe(false);
  });

  test('subresource相当は許可しURL欠落のtop frameは拒否する', () => {
    const shouldStart = createDOMNavigationPolicy();
    expect(shouldStart({ url: 'file:///editor/index.html', isTopFrame: true })).toBe(true);
    expect(shouldStart({ url: 'file:///editor/font.woff2', isTopFrame: false })).toBe(true);
    expect(shouldStart({ url: '', isTopFrame: true })).toBe(false);
  });
});
