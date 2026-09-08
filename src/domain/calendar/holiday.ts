export type Holiday = Readonly<{ date: string; name: string }>;

export type HolidayRangeResult =
  | Readonly<{ status: 'available'; holidays: readonly Holiday[] }>
  | Readonly<{ status: 'unsupported' }>;

export interface HolidayProvider {
  list(from: string, through: string): HolidayRangeResult;
}
