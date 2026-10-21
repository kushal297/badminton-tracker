import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/lib/fetchAll";

type Row = { id: number };

function fakeSource(rows: Row[], failOnCall?: number) {
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    if (failOnCall === calls.length) return { data: null, error: { code: "boom" } };
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { calls, fetchPage };
}

const make = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe("fetchAllRows", () => {
  it("pages through 5 rows in order", async () => {
    const { calls, fetchPage } = fakeSource(make(5));
    expect(await fetchAllRows(fetchPage, 2)).toEqual(make(5));
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("makes a third, empty call when the row count is a multiple of the page size", async () => {
    const { calls, fetchPage } = fakeSource(make(4));
    expect(await fetchAllRows(fetchPage, 2)).toEqual(make(4));
    expect(calls).toHaveLength(3);
  });

  it("rejects with the error from a later page", async () => {
    const { fetchPage } = fakeSource(make(5), 2);
    await expect(fetchAllRows(fetchPage, 2)).rejects.toEqual({ code: "boom" });
  });

  it("returns [] after one call for an empty table", async () => {
    const { calls, fetchPage } = fakeSource([]);
    expect(await fetchAllRows(fetchPage, 2)).toEqual([]);
    expect(calls).toEqual([[0, 1]]);
  });

  it("treats null data without an error as an empty page", async () => {
    const calls: number[] = [];
    const fetchPage = async (from: number) => {
      calls.push(from);
      return { data: null, error: null };
    };
    expect(await fetchAllRows<Row>(fetchPage, 2)).toEqual([]);
    expect(calls).toEqual([0]);
  });
});
