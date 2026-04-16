import { useEffect, useState } from "react";

import { Props, TopicInfoDetailed, TopicMap } from "@/models/question/questionType";

import { TopicContext } from "./TopicContext";
import { getTopics } from "@/services/question/topicService";

export function TopicProvider({ children }: Props) {
    const [topics, setTopics] = useState<TopicMap>({});
    const [fullTopicInfo, setFullInfo] = useState<TopicInfoDetailed[]>([]);

    const refreshTopics = async () => {
        const topics = await getTopics();

        //get all topics
        if (topics != null) {
            setTopics(topics.topicMap);
            setFullInfo(topics.fullInfo);
        }
    };

    useEffect(() => {
        const fetchTopics = async () => {
            const topics = await getTopics();

            //get all topics
            if (topics != null) {
                setTopics(topics.topicMap);
                setFullInfo(topics.fullInfo);
            }
        };
        fetchTopics();
    }, []);

    return (
        <TopicContext.Provider value={{ topics, setTopics, refreshTopics, fullTopicInfo }}>
            {children}
        </TopicContext.Provider>
    );
}
