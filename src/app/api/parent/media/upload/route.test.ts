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

function makeRequest(options?: {
  formData?: FormData | null;
  headers?: HeadersInit;
}): Request {
  const headers = new Headers(options?.headers);
  return {
    headers,
    formData: vi.fn().mockResolvedValue(options?.formData ?? new FormData()),
  } as unknown as Request;
}

describe("POST /api/parent/media/upload", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getSupabaseAdminMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const response = await POST(makeRequest());
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

    const form = new FormData();
    form.set("file", new File(["abc"], "hero.png", { type: "image/png" }));
    const response = await POST(makeRequest({ formData: form }));
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SUPABASE_NOT_CONFIGURED");
  });

  it("returns 400 for non-image files", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(),
      },
    });

    const form = new FormData();
    form.set("file", new File(["abc"], "notes.txt", { type: "text/plain" }));

    const response = await POST(makeRequest({ formData: form }));
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for files over 10MB", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(),
      },
    });

    const form = new FormData();
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    form.set("file", new File([bytes], "large.png", { type: "image/png" }));

    const response = await POST(makeRequest({ formData: form }));
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(payload.error.message).toContain("10MB");
  });

  it("uploads image and returns a public URL", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrlMock = vi
      .fn()
      .mockReturnValue({ data: { publicUrl: "https://cdn.example.com/hero.png" } });
    const fromMock = vi.fn().mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: fromMock,
      },
    });

    const form = new FormData();
    form.set("kind", "avatar");
    form.set("file", new File(["abc"], "hero.png", { type: "image/png" }));

    const response = await POST(makeRequest({ formData: form }));
    const payload = (await response.json()) as {
      ok: boolean;
      url: string;
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.url).toBe("https://cdn.example.com/hero.png");
    expect(fromMock).toHaveBeenCalledWith("hero-media");
    const uploadedPath = String(uploadMock.mock.calls[0]?.[0] ?? "");
    expect(uploadedPath.startsWith("avatars/")).toBe(true);
  });
});
