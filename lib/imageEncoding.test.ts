import { describe, expect, it } from "vitest";
import { needsJpegFallback, pickEncoding } from "@/lib/imageEncoding";

describe("pickEncoding", () => {
  it("keeps webp when the browser produced a webp blob", () => {
    expect(pickEncoding("image/webp")).toEqual({ ext: "webp", contentType: "image/webp" });
  });

  it("uses jpg when the browser fell back to png (Safari)", () => {
    expect(pickEncoding("image/png")).toEqual({ ext: "jpg", contentType: "image/jpeg" });
  });

  it("uses jpg when the blob type is empty", () => {
    expect(pickEncoding("")).toEqual({ ext: "jpg", contentType: "image/jpeg" });
  });
});

describe("needsJpegFallback", () => {
  it("falls back when the browser returned no blob for webp", () => {
    expect(needsJpegFallback(null)).toBe(true);
  });

  it("falls back when the browser silently returned a png", () => {
    expect(needsJpegFallback({ type: "image/png" })).toBe(true);
  });

  it("does not fall back when webp encoding worked", () => {
    expect(needsJpegFallback({ type: "image/webp" })).toBe(false);
  });
});
