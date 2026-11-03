import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("junta classes, ignora falsos e deixa a última vencer no conflito do Tailwind", () => {
    expect(cn("px-2", false, null, undefined, "text-sm", { hidden: false, block: true })).toBe("px-2 text-sm block");
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
