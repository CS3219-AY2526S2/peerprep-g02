import { AppConstants } from "@/constants.js";


export class QuestionPopularityService {
    private readonly questionInternalBaseUrl = `${AppConstants.QUESTION_SERVICE_URL}`;

    async updateQuestionPopularityScore(updates: { quid: string; }): Promise<
        number> {
        const result = await fetch(
            `${this.questionInternalBaseUrl}/popularity`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
                },
                body: JSON.stringify({ updates }),
            },
        );
        return result.status
    }

}
