import { useState } from "react";

import QuestionForm from "@/components/question/QuestionForm";

import Admin from "@/views/question/QuestionEditorView";

export default function QuestionMainView() {
    return <AdminPage />;
}

function AdminPage() {
    const [activeMain, setToggle] = useState<boolean>(true);
    return activeMain === true ? (
        <Admin toggler={setToggle} />
    ) : (
        <QuestionForm toggler={setToggle} />
    );
}
