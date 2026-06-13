import { describe, it, expect } from "vitest";
import { computeDiff } from "./diff";

describe("computeDiff", () => {
  it("returns empty diff for identical empty objects", () => {
    expect(computeDiff({}, {})).toEqual([]);
  });

  it("detects added keys", () => {
    const diff = computeDiff({}, { name: "Alice" });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ key: "name", type: "added", newValue: "Alice" });
  });

  it("detects removed keys", () => {
    const diff = computeDiff({ status: "active" }, {});
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ key: "status", type: "removed", oldValue: "active" });
  });

  it("detects changed primitive values", () => {
    const diff = computeDiff({ count: 1 }, { count: 2 });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      key: "count",
      type: "changed",
      oldValue: 1,
      newValue: 2,
    });
  });

  it("marks unchanged keys", () => {
    const diff = computeDiff({ id: "ctx_01" }, { id: "ctx_01" });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ key: "id", type: "unchanged" });
  });

  it("recurses into nested objects", () => {
    const oldVal = { report: { pages: 47, sections: ["revenue"] } };
    const newVal = { report: { pages: 48, sections: ["revenue", "ops"] } };
    const diff = computeDiff(oldVal, newVal);

    expect(diff).toHaveLength(1);
    expect(diff[0]?.key).toBe("report");
    expect(diff[0]?.type).toBe("changed");
    expect(diff[0]?.children?.map((c) => c.key)).toEqual(
      expect.arrayContaining(["pages", "sections"]),
    );
  });

  it("treats null/undefined old values as empty objects", () => {
    const diff = computeDiff(null, { report: "Q3" });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ key: "report", type: "added" });
  });

  it("sorts results: added, removed, changed, unchanged", () => {
    const diff = computeDiff(
      { keep: 1, remove: "x", change: "old" },
      { keep: 1, add: "new", change: "new" },
    );
    const types = diff.map((d) => d.type);
    expect(types.indexOf("added")).toBeLessThan(types.indexOf("removed"));
    expect(types.indexOf("removed")).toBeLessThan(types.indexOf("changed"));
    expect(types.indexOf("changed")).toBeLessThan(types.indexOf("unchanged"));
  });

  it("detects array value changes", () => {
    const diff = computeDiff({ tags: ["a", "b"] }, { tags: ["a", "c"] });
    expect(diff[0]).toMatchObject({
      key: "tags",
      type: "changed",
      oldValue: ["a", "b"],
      newValue: ["a", "c"],
    });
  });
});
