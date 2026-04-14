import "dotenv/config";
import http from "http";

type InternalAuthResponse = {
  data: {
    clerkUserId: string;
    role?: string;
    status?: string;
  };
};

export async function socketAuthMiddleware(
  req: http.IncomingMessage,
): Promise<InternalAuthResponse | null> {
  const internalServiceApiKey = process.env.INTERNAL_SERVICE_API_KEY;
  const token = req.headers["sec-websocket-protocol"];

  if (!token) {
    return null;
  }
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "x-internal-service-key": internalServiceApiKey,
  } as HeadersInit;

  try {
    const response = await fetch(
      `${process.env.USER_SERVICE_URL}${process.env.USER_AUTH_CONTEXT_PATH}`,
      {
        headers: headers,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as InternalAuthResponse;
    if (payload.data.status !== "active" || !payload.data.clerkUserId) {
      return null;
    }

    return payload;
  } catch (error) {
    console.log(error);
    return null;
  }
}
