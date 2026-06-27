/** Position GPS pour filigrane terrain (best-effort, sans bloquer la capture). */
export function getCurrentPosition(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 120_000 }
    );
  });
}

export function formatGps(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return `GPS ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}
