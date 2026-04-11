import { useState } from "react";

import QuestionForm from "@/components/question/QuestionForm";

import Admin from "@/views/question/QuestionEditorView";

import { TopicProvider, UseCaseProvider } from "@/context/TopicProvider";


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
    // const [loading, setLoading] = useState<boolean>(true);
    const [activeMain, setToggle] = useState<boolean>(true);
    // const { setTopics } = useTopics();

    // useEffect(() => {
    //     const fetchTopics = async () => {
    //         const topics = await getTopics();

    //         //get all topics
    //         if (topics != null) {
    //             setTopics(topics);
    //         }
    //         setLoading(false);
    //     };
    //     fetchTopics();
    // }, []);

    // if (loading) {
    //     return <div>Loading</div>;
    // }
    return activeMain === true ? (
        <Admin toggler={setToggle} />
    ) : (
        <QuestionForm toggler={setToggle} />
    );
}
