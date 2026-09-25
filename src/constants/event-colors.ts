export type EventColorId =
  | 'blue'
  | 'teal'
  | 'green'
  | 'ochre'
  | 'orange'
  | 'red'
  | 'purple'
  | 'gray';

export const DEFAULT_EVENT_COLOR_ID: EventColorId = 'blue';

export const EVENT_COLOR_PALETTE: readonly Readonly<{
  id: EventColorId;
  light: string;
  dark: string;
}>[] = [
  { id: 'blue', light: '#185ABC', dark: '#AECBFA' },
  { id: 'teal', light: '#00695C', dark: '#80CBC4' },
  { id: 'green', light: '#2E7D32', dark: '#81C995' },
  { id: 'ochre', light: '#795548', dark: '#FDD663' },
  { id: 'orange', light: '#A14200', dark: '#FFB74D' },
  { id: 'red', light: '#B3261E', dark: '#F28B82' },
  { id: 'purple', light: '#6A1B9A', dark: '#D7AEFB' },
  { id: 'gray', light: '#5F6368', dark: '#BDC1C6' },
];

export function getEventColor(id: EventColorId, colorScheme: 'light' | 'dark'): string {
  return (EVENT_COLOR_PALETTE.find((color) => color.id === id) ?? EVENT_COLOR_PALETTE[0])[colorScheme];
}

function linearizeRgbChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(hex: string): number {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
    .map((channel) => linearizeRgbChannel(Number.parseInt(channel, 16)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getContrastRatio(first: string, second: string): number {
  const brighter = Math.max(getRelativeLuminance(first), getRelativeLuminance(second));
  const darker = Math.min(getRelativeLuminance(first), getRelativeLuminance(second));
  return (brighter + 0.05) / (darker + 0.05);
}
