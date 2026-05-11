export type RelationMenuPositionInput = {
  anchorX: number;
  anchorY: number;
  viewportWidth: number;
  viewportHeight: number;
  containerLeft?: number;
  containerTop?: number;
  menuWidth?: number;
  menuHeight?: number;
  offset?: number;
};

export function getRelationMenuPosition(input: RelationMenuPositionInput) {
  const menuWidth = input.menuWidth ?? 288;
  const menuHeight = input.menuHeight ?? 420;
  const offset = input.offset ?? 12;
  const margin = 16;
  const containerLeft = input.containerLeft ?? 0;
  const containerTop = input.containerTop ?? 0;
  const localAnchorX = input.anchorX - containerLeft;
  const localAnchorY = input.anchorY - containerTop;
  const naturalX = localAnchorX + offset;
  const naturalY = localAnchorY + offset;

  return {
    x: clamp(naturalX, margin, input.viewportWidth - menuWidth - margin),
    y: clamp(naturalY, margin, input.viewportHeight - menuHeight - margin)
  };
}

export function getEffectiveHighlightedTag(input: {
  hoveredTag: string | null;
  lockedTag: string | null;
}) {
  return input.lockedTag ?? input.hoveredTag;
}

export function toggleLockedTag(currentLockedTag: string | null, nextTag: string) {
  return currentLockedTag === nextTag ? null : nextTag;
}

export function isTagLocked(tag: string, lockedTag: string | null) {
  return tag === lockedTag;
}

export function clearCanvasSelection() {
  return {
    selectedNodeId: null,
    selectedRelation: null,
    hoveredTag: null,
    lockedTag: null
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
