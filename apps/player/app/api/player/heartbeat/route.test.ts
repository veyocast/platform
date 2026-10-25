import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => ({ rpc })
}));

import { POST } from "./route";

describe("player heartbeat API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("normaliseert een onbekende syncfase zodat een geldige heartbeat niet faalt", async () => {
    rpc
      .mockResolvedValueOnce({
        data: "71000000-0000-4000-8000-000000000001",
        error: null
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "AUTOMATION_NOT_CONFIGURED" }
      });

    const response = await heartbeat({
      runtimeState: "PLAYING",
      syncPhase: "lg-legacy"
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "record_player_heartbeat_v3",
      expect.objectContaining({
        p_runtime_state: "PLAYING",
        p_sync_phase: null
      })
    );
  });

  it("levert een exact sync-verzoek en de Playerbevestiging zonder timestampafronding", async () => {
    const stamp = "2026-10-15T23:00:01.123456+00:00";
    rpc.mockResolvedValueOnce({ data: { heartbeatId: "heartbeat", syncRetryRequestedAt: stamp }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const response = await heartbeat({ runtimeState: "PLAYING", syncPhase: "active", syncRetryAcknowledgedAt: stamp });
    expect(await response.json()).toMatchObject({ ok: true, syncRetryRequestedAt: stamp });
    expect(rpc).toHaveBeenNthCalledWith(1, "record_player_heartbeat_v3", expect.objectContaining({ p_sync_detail: expect.objectContaining({ syncRetryAcknowledgedAt: stamp }) }));
  });

  it("bewaart uitsluitend begrensde compatibiliteitsresultaten van de gekoppelde Player", async () => {
    rpc.mockResolvedValueOnce({data:{heartbeatId:"heartbeat",syncRetryRequestedAt:null},error:null}).mockResolvedValueOnce({data:null,error:null});
    await heartbeat({runtimeState:"PLAYING",syncPhase:"active",videoProbe:{code:"LG-BLOB-MEMORY",createdAt:"2026-10-16T00:00:00Z",url:"private-url",userAgent:"private-agent",results:[{id:"blob",status:"fail",message:"private-message"}]}});
    expect(rpc).toHaveBeenNthCalledWith(1,"record_player_heartbeat_v3",expect.objectContaining({p_sync_detail:expect.objectContaining({videoProbe:{code:"LG-BLOB-MEMORY",createdAt:"2026-10-16T00:00:00.000Z",results:[{id:"blob",status:"fail"}]}})}));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("private");
  });

  it("verwijdert een geldige schermcredential niet bij een heartbeat-validatiefout", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23514" }
      })
      .mockResolvedValueOnce({
        data: "PAIRED",
        error: null
      });

    const response = await heartbeat({
      runtimeState: "PLAYING",
      syncPhase: "active"
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("PLAYER_API_UNAVAILABLE");
  });

  it("blijft een werkelijk onbekende schermcredential definitief afwijzen", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002" }
      })
      .mockResolvedValueOnce({
        data: "INVALID_DEVICE_TOKEN",
        error: null
      });

    const response = await heartbeat({
      runtimeState: "READY",
      syncPhase: null
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_DEVICE_TOKEN");
  });
  it('records explicit DOM capability separately from a bounded actual-frame confirmation',async()=>{
    const frame={schemaVersion:2,itemId:'29200000-0000-4000-8000-000000000003',configurationSnapshotId:'29200000-0000-4000-8000-000000000005',dataRevision:2,contentHash:'a'.repeat(64),rendererVersion:'sync-onzetrots-v9'};
    rpc.mockResolvedValueOnce({data:'heartbeat',error:null}).mockResolvedValueOnce({data:null,error:null});
    const binaryFrame={schemaVersion:1,transport:'binary',itemId:frame.itemId,configurationSnapshotId:frame.configurationSnapshotId,dataRevision:3,contentHash:frame.contentHash};
    await heartbeat({runtimeState:'PLAYING',syncPhase:'active',sourceDataConfirmation:binaryFrame});
    expect(rpc).toHaveBeenNthCalledWith(1,'record_player_heartbeat_v3',expect.objectContaining({p_capabilities:expect.objectContaining({manifestSchemaVersions:[1]}),p_sync_detail:expect.objectContaining({sourceDataConfirmation:binaryFrame})}));
    for(const invalid of [false,true]){
      rpc.mockReset();rpc.mockResolvedValueOnce({data:'heartbeat',error:null}).mockResolvedValueOnce({data:null,error:null});
      const result=await heartbeat({runtimeState:'PLAYING',syncPhase:'active',sourceDomProtocol:2,sourceDataConfirmation:invalid?{...frame,providerUrl:'https://untrusted.example'}:frame});
      expect(result.status).toBe(200);
      expect(rpc).toHaveBeenNthCalledWith(1,'record_player_heartbeat_v3',expect.objectContaining({p_capabilities:expect.objectContaining({manifestSchemaVersions:[1,2],sourceDomProtocol:2}),p_sync_detail:expect.objectContaining({sourceDataConfirmation:invalid?null:frame})}));
    }
    rpc.mockReset();rpc.mockResolvedValueOnce({data:'heartbeat',error:null}).mockResolvedValueOnce({data:null,error:null});
    await heartbeat({runtimeState:'PLAYING',syncPhase:'active'});
    expect(rpc).toHaveBeenNthCalledWith(1,'record_player_heartbeat_v3',expect.objectContaining({p_capabilities:expect.objectContaining({manifestSchemaVersions:[1]}),p_sync_detail:expect.objectContaining({sourceDataConfirmation:null})}));
  });

});

function heartbeat(body: {
  runtimeState: string;
  syncPhase: string | null;
  syncRetryAcknowledgedAt?: unknown;
  videoProbe?: unknown;
  sourceDomProtocol?:unknown;
  sourceDataConfirmation?:unknown;
}) {
  return POST(
    new Request("https://player.veyocast.nl/api/player/heartbeat", {
      body: JSON.stringify({
        activeReleaseId: null,
        currentItemId: null,
        desiredReleaseId: null,
        networkState: "online",
        ...body
      }),
      headers: {
        Authorization: `Bearer ${"d".repeat(48)}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    })
  );
}
