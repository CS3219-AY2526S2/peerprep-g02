import { useState } from "react";

import QuestionForm from "@/components/question/QuestionForm";

import Admin from "@/views/question/QuestionEditorView";

import { TopicProvider } from "@/context/TopicProvider";
import { UseCaseProvider } from "@/context/UsecaseContext";

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
    const [activeMain, setToggle] = useState<boolean>(true);
    return activeMain === true ? (
        <Admin toggler={setToggle} />
    ) : (
        <QuestionForm toggler={setToggle} />
    );
}
