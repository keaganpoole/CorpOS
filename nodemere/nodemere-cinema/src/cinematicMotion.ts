// Cubic Hermite paths preserve velocity through each camera waypoint.
export function continuousTrack(
  t: number,
  times: number[],
  values: number[],
  slopes: number[],
) {
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  const i = times.findIndex((v, j) => j > 0 && v > t) - 1;
  const d = times[i + 1] - times[i];
  const u = (t - times[i]) / d;
  return (
    (2 * u * u * u - 3 * u * u + 1) * values[i] +
    (u * u * u - 2 * u * u + u) * d * slopes[i] +
    (-2 * u * u * u + 3 * u * u) * values[i + 1] +
    (u * u * u - u * u) * d * slopes[i + 1]
  );
}
