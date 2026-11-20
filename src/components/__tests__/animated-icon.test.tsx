import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AnimatedSplashOverlay } from '../animated-icon';

jest.mock('@/assets/images/icon-android.png', () => 'app-icon');
jest.mock('@/assets/images/expo-logo.png', () => 'expo-logo');
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));
jest.mock('react-native-reanimated', () => ({
  Easing: { elastic: jest.fn() },
  Keyframe: jest.fn(),
}));
jest.mock('expo-image', () => {
  const { Image } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image };
});

test('起動アニメーションは白背景にアプリのアイコンを表示する', async () => {
  await render(<AnimatedSplashOverlay />);

  const image = screen.getByTestId('splash-icon');
  expect(image.props.source).toBe('app-icon');
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 76, height: 76 });
  expect(StyleSheet.flatten(image.parent?.props.style)).toMatchObject({ backgroundColor: '#FFFFFF' });
});
