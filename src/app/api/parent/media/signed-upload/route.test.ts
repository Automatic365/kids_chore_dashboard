import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { POST } from "./route";

describe("POST /api/parent/media/signed-upload", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getSupabaseAdminMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/parent/media/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 503 when Supabase admin is unavailable", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getSupabaseAdminMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/parent/media/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          fileName: "hero.png",
          fileType: "image/png",
          fileSize: 1234,
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SUPABASE_NOT_CONFIGURED");
  });

  it("returns 400 for unsupported image types", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/parent/media/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          fileName: "hero.bmp",
          fileType: "image/bmp",
          fileSize: 1234,
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
  });

  it("returns signed upload data on valid request", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const createSignedUploadUrlMock = vi.fn().mockResolvedValue({
      data: {
        path: "avatars/abc.png",
        token: "tok123",
      },
      error: null,
    });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: {
        publicUrl: "https://cdn.example.com/avatars/abc.png",
      },
    });
    const fromMock = vi.fn().mockReturnValue({
      createSignedUploadUrl: createSignedUploadUrlMock,
      getPublicUrl: getPublicUrlMock,
    });

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: fromMock,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/parent/media/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          fileName: "hero.png",
          fileType: "image/png",
          fileSize: 4567,
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      bucket: string;
      path: string;
      token: string;
      url: string;
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.bucket).toBe("hero-media");
    expect(payload.path).toBe("avatars/abc.png");
    expect(payload.token).toBe("tok123");
    expect(payload.url).toBe("https://cdn.example.com/avatars/abc.png");
    expect(fromMock).toHaveBeenCalledWith("hero-media");
  });
});

