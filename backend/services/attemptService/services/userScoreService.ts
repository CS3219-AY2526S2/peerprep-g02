import { AppConstants } from "@/constants.js";
import { ServiceError } from "@/utils/ResponseHelpers.js";

type UserScorePayload = {
  data?: {
    user?: {
      clerkUserId?: string;
      score?: number;
    };
  };
};

type ScoreDeltaPayload = {
  data?: {
    updates?: Array<{
      clerkUserId?: string;
      previousScore?: number;
      newScore?: number;
      delta?: number;
    }>;
  };
};

export class UserScoreService {
  private readonly userInternalBaseUrl = `${AppConstants.USER_SERVICE_URL}/users/internal`;

  async getScore(clerkUserId: string): Promise<number> {
    const payload = await this.fetchUserScore<UserScorePayload>(
      `${this.userInternalBaseUrl}/${clerkUserId}/score`,
      {
        method: "GET",
        headers: {
          "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
        },
      },
      "fetch user score",
    );

    const score = payload.data?.user?.score;
    if (!Number.isInteger(score) || (score ?? -1) < 0) {
      throw new ServiceError(
        424,
        "User service returned an invalid score response.",
      );
    }

    return score as number;
  }

  async updateScore(clerkUserId: string, score: number): Promise<number> {
    const payload = await this.fetchUserScore<UserScorePayload>(
      `${this.userInternalBaseUrl}/${clerkUserId}/score`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
        },
        body: JSON.stringify({ score }),
      },
      "update user score",
    );

    const updatedScore = payload.data?.user?.score;
    if (!Number.isInteger(updatedScore) || (updatedScore ?? -1) < 0) {
      throw new ServiceError(
        424,
        "User service returned an invalid score update response.",
      );
    }

    return updatedScore as number;
  }

  async applyScoreDeltas(
    updates: Array<{ clerkUserId: string; delta: number }>,
  ): Promise<
    Array<{
      clerkUserId: string;
      previousScore: number;
      newScore: number;
      delta: number;
    }>
  > {
    const payload = await this.fetchUserScore<ScoreDeltaPayload>(
      `${this.userInternalBaseUrl}/deltas`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
        },
        body: JSON.stringify({ updates }),
      },
      "apply user score deltas",
    );

    const scoreUpdates = payload.data?.updates;
    if (
      !Array.isArray(scoreUpdates) ||
      scoreUpdates.length !== updates.length
    ) {
      throw new ServiceError(
        424,
        "User service returned an invalid score delta response.",
      );
    }

    return scoreUpdates.map((scoreUpdate) => {
      const clerkUserId = scoreUpdate.clerkUserId;
      const previousScore = scoreUpdate.previousScore;
      const newScore = scoreUpdate.newScore;
      const delta = scoreUpdate.delta;

      if (
        typeof clerkUserId !== "string" ||
        !Number.isInteger(previousScore) ||
        !Number.isInteger(newScore) ||
        !Number.isInteger(delta)
      ) {
        throw new ServiceError(
          424,
          "User service returned an invalid score delta response.",
        );
      }

      return {
        clerkUserId,
        previousScore: previousScore as number,
        newScore: newScore as number,
        delta: delta as number,
      };
    });
  }

  private async fetchUserScore<T>(
    url: string,
    init: RequestInit,
    action: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AppConstants.DEPENDENCY_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as T | null;

      if (!response.ok) {
        throw new ServiceError(
          424,
          `Failed to ${action}: user service responded with status ${response.status}.`,
        );
      }

      if (!payload) {
        throw new ServiceError(
          424,
          `Failed to ${action}: empty user service response.`,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(
        424,
        `Failed to ${action}: user service is unavailable.`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
