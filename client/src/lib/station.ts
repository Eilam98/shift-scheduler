// The time clock device's secret key, kept in this browser only. Sent as
// X-Station-Token; it is not a user login.
const STATION_KEY = 'shift-organizer.station'

export function getStationKey(): string | null {
  try {
    return localStorage.getItem(STATION_KEY)
  } catch {
    return null
  }
}

export function setStationKey(key: string | null) {
  try {
    if (key) localStorage.setItem(STATION_KEY, key)
    else localStorage.removeItem(STATION_KEY)
  } catch {
    // storage unavailable — the device just won't stay activated
  }
}

export const stationHeaders = (key: string) => ({ 'X-Station-Token': key })
