/** 別の日付列に指が分かれても、複数指操作の終了を単独タップとして数えない。 */
export function createTimelineTouchSession() {
  let blocked = false;
  let epoch = 0;
  return {
    start(count: number) {
      if (count > 1) { if (!blocked) epoch += 1; blocked = true; }
      else if (count === 1) blocked = false;
    },
    cancel() { epoch += 1; blocked = true; },
    isBlocked() { return blocked; },
    epoch() { return epoch; },
  };
}
