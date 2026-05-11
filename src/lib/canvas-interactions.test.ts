import { describe, expect, it } from "vitest";

import {
  clearCanvasSelection,
  getEffectiveHighlightedTag,
  getRelationMenuPosition,
  isTagLocked,
  toggleLockedTag
} from "./canvas-interactions";

describe("getRelationMenuPosition", () => {
  it("keeps the relation menu close to the clicked line while staying inside the viewport", () => {
    expect(
      getRelationMenuPosition({
        anchorX: 1180,
        anchorY: 720,
        viewportWidth: 1200,
        viewportHeight: 760,
        menuWidth: 288,
        menuHeight: 420,
        offset: 12
      })
    ).toEqual({
      x: 896,
      y: 324
    });
  });

  it("uses the natural lower-right position when there is enough space", () => {
    expect(
      getRelationMenuPosition({
        anchorX: 320,
        anchorY: 180,
        viewportWidth: 1200,
        viewportHeight: 760,
        menuWidth: 288,
        menuHeight: 420,
        offset: 12
      })
    ).toEqual({
      x: 332,
      y: 192
    });
  });

  it("positions inside the canvas container instead of the browser window", () => {
    expect(
      getRelationMenuPosition({
        anchorX: 1130,
        anchorY: 230,
        viewportWidth: 720,
        viewportHeight: 620,
        containerLeft: 620,
        containerTop: 90,
        menuWidth: 288,
        menuHeight: 420,
        offset: 12
      })
    ).toEqual({
      x: 416,
      y: 152
    });
  });
});

describe("tag highlight state", () => {
  it("uses locked tag before transient hover", () => {
    expect(
      getEffectiveHighlightedTag({
        hoveredTag: "画布",
        lockedTag: "关系线"
      })
    ).toBe("关系线");
  });

  it("clicking the same tag unlocks it", () => {
    expect(toggleLockedTag("画布", "画布")).toBeNull();
    expect(toggleLockedTag(null, "画布")).toBe("画布");
  });

  it("marks the selected tag itself as locked", () => {
    expect(isTagLocked("画布", "画布")).toBe(true);
    expect(isTagLocked("关系线", "画布")).toBe(false);
  });
});

describe("clearCanvasSelection", () => {
  it("clears node selection, relation menu, and tag highlights together", () => {
    expect(clearCanvasSelection()).toEqual({
      selectedNodeId: null,
      selectedRelation: null,
      hoveredTag: null,
      lockedTag: null
    });
  });
});
