const BASE_URL = "https://apis.roblox.com/assets/v1";
const MAX_RETRIES = 3;
const BACKOFF_SECS = [1, 2, 4];
const OPERATION_POLL_INTERVAL_MS = 2000;
const OPERATION_MAX_POLLS = 30;

export class RobloxApiError extends Error {
  constructor(
    public code:
      | "validation"
      | "auth"
      | "rate_limit"
      | "server"
      | "network"
      | "operation_timeout"
      | "operation_failed",
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RobloxApiError";
  }

  get isRetryable(): boolean {
    return (
      this.code === "rate_limit" ||
      this.code === "server" ||
      this.code === "network"
    );
  }
}

function classifyHttpError(status: number, body: string): RobloxApiError {
  if (status === 400)
    return new RobloxApiError("validation", `Validation error: ${body}`);
  if (status === 401 || status === 403)
    return new RobloxApiError("auth", `Auth error: ${body}`);
  if (status === 429)
    return new RobloxApiError("rate_limit", "Rate limited");
  if (status >= 500)
    return new RobloxApiError("server", `Server error (${status}): ${body}`);
  return new RobloxApiError("server", `HTTP ${status}: ${body}`);
}

interface AuthHeaders {
  "x-api-key"?: string;
  Authorization?: string;
}

export function makeAuthHeaders(
  authType: "api_key" | "oauth",
  token: string
): AuthHeaders {
  if (authType === "api_key") {
    return { "x-api-key": token };
  }
  return { Authorization: `Bearer ${token}` };
}

async function executeWithRetry<T>(
  fn: () => Promise<T>
): Promise<T> {
  let lastError: RobloxApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RobloxApiError) || !e.isRetryable || attempt === MAX_RETRIES) {
        throw e;
      }
      lastError = e;
      const delay =
        e.code === "rate_limit" && e.retryAfter
          ? e.retryAfter * 1000
          : (BACKOFF_SECS[attempt] ?? 4) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new RobloxApiError("network", "Max retries exceeded");
}

interface OperationResponse {
  path?: string;
  done?: boolean;
  response?: { assetId?: string };
  error?: { code?: number; message?: string };
}

async function pollOperation(
  operationPath: string,
  authHeaders: AuthHeaders
): Promise<string> {
  const operationId = operationPath.split("/").pop() ?? operationPath;

  for (let i = 0; i < OPERATION_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, OPERATION_POLL_INTERVAL_MS));

    let resp: Response;
    try {
      resp = await fetch(`${BASE_URL}/operations/${operationId}`, {
        headers: authHeaders as Record<string, string>,
      });
    } catch (e) {
      continue;
    }

    if (!resp.ok) {
      const body = await resp.text();
      const err = classifyHttpError(resp.status, body);
      if (err.isRetryable) continue;
      throw err;
    }

    const op: OperationResponse = await resp.json();

    if (op.error) {
      throw new RobloxApiError(
        "operation_failed",
        op.error.message ?? "Unknown operation error"
      );
    }

    if (op.done && op.response?.assetId) {
      return op.response.assetId;
    }
  }

  throw new RobloxApiError("operation_timeout", "Operation polling timed out");
}

export async function createAsset(
  file: Uint8Array,
  filename: string,
  assetType: string,
  displayName: string,
  creatorType: "user" | "group",
  creatorId: string,
  authHeaders: AuthHeaders
): Promise<string> {
  return executeWithRetry(async () => {
    const creator =
      creatorType === "user"
        ? { userId: creatorId }
        : { groupId: creatorId };

    const requestJson = JSON.stringify({
      assetType,
      displayName,
      description: "",
      creationContext: { creator },
    });

    const formData = new FormData();
    formData.append(
      "request",
      new Blob([requestJson], { type: "application/json" })
    );
    formData.append(
      "fileContent",
      new Blob([new Uint8Array(file)], { type: "application/octet-stream" }),
      filename
    );

    let resp: Response;
    try {
      resp = await fetch(`${BASE_URL}/assets`, {
        method: "POST",
        headers: authHeaders as Record<string, string>,
        body: formData,
      });
    } catch (e) {
      throw new RobloxApiError(
        "network",
        `Network error: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (!resp.ok) {
      const body = await resp.text();
      const err = classifyHttpError(resp.status, body);
      if (resp.status === 429) {
        const retryAfter = resp.headers.get("Retry-After");
        if (retryAfter) err.retryAfter = parseInt(retryAfter, 10);
      }
      throw err;
    }

    const op: OperationResponse = await resp.json();
    if (!op.path) {
      throw new RobloxApiError("server", "No operation path in response");
    }

    return pollOperation(op.path, authHeaders);
  });
}

export async function updateAsset(
  assetId: string,
  file: Uint8Array,
  filename: string,
  assetType: string,
  authHeaders: AuthHeaders
): Promise<string> {
  return executeWithRetry(async () => {
    const requestJson = JSON.stringify({ assetType });

    const formData = new FormData();
    formData.append(
      "request",
      new Blob([requestJson], { type: "application/json" })
    );
    formData.append(
      "fileContent",
      new Blob([new Uint8Array(file)], { type: "application/octet-stream" }),
      filename
    );

    let resp: Response;
    try {
      resp = await fetch(`${BASE_URL}/assets/${assetId}`, {
        method: "PATCH",
        headers: authHeaders as Record<string, string>,
        body: formData,
      });
    } catch (e) {
      throw new RobloxApiError(
        "network",
        `Network error: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (!resp.ok) {
      const body = await resp.text();
      const err = classifyHttpError(resp.status, body);
      if (resp.status === 429) {
        const retryAfter = resp.headers.get("Retry-After");
        if (retryAfter) err.retryAfter = parseInt(retryAfter, 10);
      }
      throw err;
    }

    const op: OperationResponse = await resp.json();
    if (!op.path) {
      throw new RobloxApiError("server", "No operation path in response");
    }

    return pollOperation(op.path, authHeaders);
  });
}

export async function getOperation(
  operationId: string,
  authHeaders: AuthHeaders
): Promise<OperationResponse> {
  const resp = await fetch(`${BASE_URL}/operations/${operationId}`, {
    headers: authHeaders as Record<string, string>,
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw classifyHttpError(resp.status, body);
  }

  return resp.json();
}

export async function getUserGroups(
  userId: string
): Promise<
  Array<{
    group: { id: number; name: string };
    role: { name: string };
  }>
> {
  const resp = await fetch(
    `https://groups.roblox.com/v2/users/${userId}/groups/roles`
  );

  if (!resp.ok) {
    throw new RobloxApiError("server", `Failed to fetch groups: ${resp.status}`);
  }

  const data = await resp.json();
  return data.data ?? [];
}
