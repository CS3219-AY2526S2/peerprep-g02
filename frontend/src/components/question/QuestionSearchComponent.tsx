import { useState } from "react";

import { QuestionInfo } from "@/models/question/questionType";

import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

import { SearchQuestionDatabase } from "@/services/question/questionService";

type QuestionSearchProp = {
    updateQuestionList: React.Dispatch<React.SetStateAction<QuestionInfo[]>>;
    revertDefault: () => void;
};
export function QuestionSearch(props: QuestionSearchProp) {
    const [searchString, updateSearcString] = useState<string>("");

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const { value } = e.target;

        if (value !== "" && !/[a-zA-Z ]/.test(value.charAt(value.length - 1))) return;
        updateSearcString(value);
    };

    async function SearchDatabase() {
        if (searchString.length == 0) props.revertDefault();
        //Get all those that have edited
        const result = await SearchQuestionDatabase(searchString);
        if (result == null) {
            props.revertDefault();
            return;
        }
        props.updateQuestionList(result);
    }

    return (
        <>
            <form className="flex-grow">
                <Field orientation="horizontal">
                    <Input onChange={handleInputChange} value={searchString} />
                    <Button
                        type="button"
                        className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                        onClick={() => SearchDatabase()}
                    >
                        Search
                    </Button>
                </Field>
            </form>
        </>
    );
}

export default QuestionSearch;
