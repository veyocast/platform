import { describe, expect, it } from "vitest";

import { clearTenantScopedLocalData } from "./tenant-local-data";

describe("tenantgebonden lokale data", () => {
  it("wist herstel- en uploaddata maar bewaart persoonlijke shellvoorkeuren", () => {
    const values = new Map([
      ["veyocast:publisher-recovery:v1:tenant-a:playlist-a:2", "{}"],
      ["veyocast:publisher-recovery:v1:tenant-b:playlist-b:7", "{}"],
      ["veyocast:media-upload:pending:v1", "{}"],
      ["veyocast-control-theme", "dark"],
      ["veyocast-control-sidebar-collapsed", "false"]
    ]);
    const storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return [...values.keys()][index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      }
    };

    clearTenantScopedLocalData(storage);

    expect([...values]).toEqual([
      ["veyocast-control-theme", "dark"],
      ["veyocast-control-sidebar-collapsed", "false"]
    ]);
  });
});

