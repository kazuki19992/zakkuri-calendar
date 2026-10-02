import { createDOMNavigationPolicy } from '../dom-navigation-policy';

describe('メモDOMのnavigation policy', () => {
  test('nativeが指定した最初のdocumentと同じURLだけをtop frameに許可する', () => {
    const policy = createDOMNavigationPolicy();
    policy.seedDocumentUrl('file:///editor/index.html');

    expect(policy.shouldStart({ url: 'file:///editor/index.html', isTopFrame: true })).toBe(true);
    expect(policy.shouldStart({ url: 'https://example.com/', isTopFrame: true })).toBe(false);
    expect(policy.shouldStart({ url: 'https://example.com/redirect', isTopFrame: true,
      navigationType: 'other' })).toBe(false);
    expect(policy.shouldStart({ url: 'https://example.com/click', isTopFrame: true,
      navigationType: undefined })).toBe(false);
  });

  test('Androidで初回loadUrlがpolicy callbackを通らなくても未seedの外部遷移を拒否する', () => {
    const policy = createDOMNavigationPolicy();
    expect(policy.shouldStart({ url: 'https://example.com/', isTopFrame: true })).toBe(false);
    policy.seedDocumentUrl('file:///editor/index.html');
    expect(policy.shouldStart({ url: 'file:///editor/font.woff2', isTopFrame: false })).toBe(true);
    expect(policy.shouldStart({ url: '', isTopFrame: true })).toBe(false);
  });
});
