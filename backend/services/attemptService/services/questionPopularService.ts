import { AppConstants } from "@/constants.js";

export class QuestionPopularityService {
    async updateQuestionPopularityScore(updates: { quid: string }): Promise<number> {
        const result = await fetch(`${AppConstants.QUESTION_SERVICE_URL}/internal/popularity`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
            },
            body: JSON.stringify(updates),
        });

        return result.status;
    }
}
