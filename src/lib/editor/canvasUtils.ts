import type { Point, Stroke } from "@/types/study";
import type { PointerEvent } from "react";

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} l 0.1 0.1`;
  }

  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const midX = (previous.x + point.x) / 2;
      const midY = (previous.y + point.y) / 2;
      return `Q ${previous.x} ${previous.y} ${midX} ${midY}`;
    })
    .join(" ");
}

export function distanceToStroke(point: Point, stroke: Stroke): number {
  return Math.min(
    ...stroke.points.map((strokePoint) =>
      Math.hypot(strokePoint.x - point.x, strokePoint.y - point.y),
    ),
  );
}

export function getRelativePoint(
  event: PointerEvent<HTMLElement>,
  element: HTMLElement,
): Point {
  const rect = element.getBoundingClientRect();
  const scaleX = 794 / rect.width;
  const scaleY = 1123 / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}
