/** True on phones — Catchment and similar GPU demos skip init on these. */
export function isMobilePhone(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return true;
  }

  // Narrow, touch-first viewport — catches phones that omit "Mobile" in UA.
  const narrow = window.matchMedia("(max-width: 767px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  return narrow && coarse && noHover;
}
