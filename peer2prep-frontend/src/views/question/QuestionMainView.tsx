import { useEffect, useState } from "react";
import { TopicProvider, UseCaseProvider, useTopics } from "@/services/question/TopicProvider";
import { getTopics } from "@/services/question/topicService";
import QuestionForm from "@/components/question/QuestionForm";
import Admin from "./QuestionEditorView";

export default function QuestionMainView() {
    return (
        <TopicProvider>
            <UseCaseProvider>
                <AdminPage />
            </UseCaseProvider>
        </TopicProvider>
    );
}

function AdminPage() {
    const [loading, setLoading] = useState<boolean>(true);
    const [activeMain, setToggle] = useState<boolean>(true);
    const { setTopics } = useTopics();

    useEffect(() => {
        const fetchTopics = async () => {
            const topics = await getTopics();

            //get all topics
            if (topics != null) {
                setTopics(topics);
            }
            setLoading(false);
        };
        fetchTopics();
    }, []);

    if (loading) {
        return <div>Loading</div>;
    }
    return activeMain === true ? (
        <Admin toggler={setToggle} />
    ) : (
        <QuestionForm toggler={setToggle} />
    );
}
