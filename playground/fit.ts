/**
 * Purpose: The scaled box must take layout space because transforms do not resize layout boxes.
 */
export function fitPanel(
  panel: { width: number; height: number },
  available: { width: number; height: number },
  zoom: 'fit' | number,
): { scale: number; width: number; height: number } {
  const scale = zoom === 'fit'
    ? Math.max(Math.min(
      (available.width - 24) / panel.width,
      (available.height - 24) / panel.height,
      1,
    ), 0.05)
    : zoom;
  return { scale, width: panel.width * scale, height: panel.height * scale };
}
