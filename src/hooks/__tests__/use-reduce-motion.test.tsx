import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReduceMotion } from '../use-reduce-motion';

describe('視差効果を減らす設定', () => {
  afterEach(() => jest.restoreAllMocks());

  it('初期値を取得し、設定変更を購読して破棄時に解除する', async () => {
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const addEventListener = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as never);

    const { result, unmount } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
    const listener = addEventListener.mock.calls[0]?.[1] as unknown as
      | ((enabled: boolean) => void)
      | undefined;

    await act(() => listener?.(false));
    expect(result.current).toBe(false);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
