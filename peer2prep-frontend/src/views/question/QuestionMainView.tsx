import { useState } from "react";
import { UUID } from "node:crypto";

import Admin from "./QuestionEditorView";
import QuestionForm from "../../components/question/QuestionForm";

export default function QuestionMainView() {
    return <AdminPage />;
}

function AdminPage() {
    const [useCase, setUseCase] = useState<UUID | null>(null);
    const [activeMain, setToggle] = useState<boolean>(true);

    return activeMain === true ? (
        <Admin toggler={setToggle} useCase={setUseCase} />
    ) : (
        <QuestionForm toggler={setToggle} useCase={useCase} />
    );
}
