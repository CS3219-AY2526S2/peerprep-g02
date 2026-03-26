import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import {
    AttemptHistoryItem,
    AttemptHistoryResponse,
} from "@/models/attempt/attemptHistoryType";
import { apiFetch } from "@/utils/apiClient";

export const getAttemptHistory = async (): Promise<AttemptHistoryItem[]> => {
    const response = await apiFetch(API_ENDPOINTS.ATTEMPTS.HISTORY, {
        method: "GET",
    });

    const payload = (await response.json().catch(() => null)) as AttemptHistoryResponse | null;

    if (!response.ok) {
        throw new Error(
            payload?.error || `Failed to load attempt history (status ${response.status}).`,
        );
    }

    return Array.isArray(payload?.data?.attempts) ? payload.data.attempts : [];
};
