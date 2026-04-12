import { useEffect, useState } from "react";

import { Props, TopicMap } from "@/models/question/questionType";

import { TopicContext } from "./TopicContext";
import { getTopics } from "@/services/question/topicService";

export function TopicProvider({ children }: Props) {
    const [topics, setTopics] = useState<TopicMap>({});

    const refreshTopics = async () => {
        const topics = await getTopics();

        //get all topics
        if (topics != null) {
            setTopics(topics);
        }
    };

    useEffect(() => {
        const fetchTopics = async () => {
            const topics = await getTopics();

            //get all topics
            if (topics != null) {
                setTopics(topics);
            }
        };
        fetchTopics();
    }, []);

    return (
        <TopicContext.Provider value={{ topics, setTopics, refreshTopics }}>
            {children}
        </TopicContext.Provider>
    );
}
