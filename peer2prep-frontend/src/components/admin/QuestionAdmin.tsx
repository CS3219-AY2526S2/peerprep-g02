import { useState } from "react";
import { UUID } from "node:crypto";

import Admin from "./MainAdmin";
import QuestionForm from "./QuestionForm";

export default function QuestionAdmin() {
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
