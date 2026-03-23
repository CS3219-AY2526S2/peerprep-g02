const gatewayBase = (() => {
  const raw = import.meta.env.VITE_GATEWAY_ENDPOINT as string | undefined;
  if (!raw) {
    throw new Error("VITE_GATEWAY_ENDPOINT is not defined");
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

export const API_ENDPOINTS = {
  USERS: {
    ME: `${gatewayBase}/users/me`, // GET, DELETE
    ADMIN_LIST: `${gatewayBase}/users/admin/users`, // GET
    UPDATE_ROLE: (clerkId: string) => `${gatewayBase}/users/admin/users/${clerkId}/role`, // PATCH
    UPDATE_STATUS: (clerkId: string) => `${gatewayBase}/users/admin/users/${clerkId}/status`, // PATCH
  },

  MATCHING: {
    GATEWAY_PATH: `${gatewayBase}/matching`,
  },

  COLLABORATION: {
    SOCKET_PATH: `${gatewayBase}/sessions`,
  },

  QUESTIONS: {
    BASE: `${gatewayBase}/questions`,
    POPULAR: `${gatewayBase}/questions/popular`,
    GET_ONE: `${gatewayBase}/questions/get`,
    DELETE: `${gatewayBase}/questions/delete`,
  },
} as const;
