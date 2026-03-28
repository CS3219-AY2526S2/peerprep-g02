import { ChangeEvent, JSX, useEffect, useState } from "react";

import { UUID } from "crypto";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Difficulty, FormData } from "../../models/question/questionType";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

import { BorderedDiv } from "./QuestionComponents";
import {
    createQuestion,
    deleteQuestion,
    editQuestion,
    getQuestion,
} from "@/services/question/questionService";
import { useTopics, useUseCase } from "@/services/question/TopicProvider";

interface ITestCase {
    input: string;
    output: string;
    handleChange: (field: "input" | "output", value: string) => void;
    handleRemove: () => void;
}

function TestCases(info: ITestCase) {
    return (
        <BorderedDiv className="border-[#F8F9FA] py-2 flex">
            <div className="m-8 bg-white flex-grow">
                <Field>
                    <FieldLabel htmlFor="input" className="font-bold text-md">
                        Input
                    </FieldLabel>

                    <Textarea
                        id="input"
                        name="input"
                        placeholder="[0,1,2]"
                        value={info.input}
                        onChange={(e) => info.handleChange("input", e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border-2 border-grey-200 pl-[10px]leading-[30px] placeholder:text-grey-400"
                    />
                </Field>
            </div>
            <div className="m-8 bg-white flex-grow">
                <Field>
                    <FieldLabel htmlFor="input" className="font-bold text-md">
                        Expected Output
                    </FieldLabel>

                    <Textarea
                        id="output"
                        name="output"
                        placeholder="3"
                        value={info.output}
                        onChange={(e) => info.handleChange("output", e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border-2 border-grey-200 pl-[10px]leading-[30px] placeholder:text-grey-400"
                    />
                </Field>
            </div>
            <Button
                type="button"
                className="bg-transparent text-red-500 text-lg"
                onClick={() => info.handleRemove()}
            >
                x
            </Button>
        </BorderedDiv>
    );
}

interface SearchFieldProps {
    formTopics: UUID[];
    updateFormTopics: React.Dispatch<React.SetStateAction<FormData>>;
}

export function TopicSearch(props: SearchFieldProps) {
    const { topics } = useTopics();
    const [query, setQuery] = useState<string>("");
    const [results, setResults] = useState<string[]>([]);
    const [topicPool, setTopicPool] = useState<Record<string, UUID>>({});
    const [searchSpace, updateSearchSpace] = useState<string[]>([]);
    if (!topics) return;

    useEffect(() => {
        //Initialize topic pool
        const topicIds: Record<string, UUID> = Object.fromEntries(
            Object.entries(topics as Record<UUID, string>).map(([key, value]) => [value, key]),
        ) as Record<string, UUID>;

        setTopicPool(topicIds);
        updateSearchSpace(Object.keys(topicIds));
        setResults(Object.values(topics));
    }, []);

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        const filtered: string[] = searchSpace.filter((item) =>
            item.toLowerCase().includes(value.toLowerCase()),
        );
        setResults(filtered);
    };

    const handleUpdate = (topic: string) => {
        updateSearchSpace((prev) => {
            return prev.filter((item) => item !== topic);
        });

        setResults((prev) => {
            return prev.filter((item) => item !== topic);
        });

        props.updateFormTopics((prev) => ({
            ...prev,
            qnTopics: [...prev.qnTopics, topicPool[topic] as UUID],
        }));
    };

    const handleRemove = (topic: UUID) => {
        updateSearchSpace((prev) => [...prev, topics[topic]]);
        if (topics[topic].toLowerCase().includes(query.toLowerCase())) {
            setResults((prev) => [...prev, topics[topic]]);
        }

        props.updateFormTopics((prev) => {
            const updatedTopics = prev.qnTopics.filter((item) => item !== topic);
            return {
                ...prev,
                qnTopics: updatedTopics,
            };
        });
    };

    return (
        <div className="space-y-2 w-full max-w-md">
            <Label htmlFor="search" className="font-bold">
                Topics
            </Label>
            <div>
                {topics !== null ? (
                    props.formTopics.map((key) => (
                        <Badge
                            key={key}
                            className="bg-secondary-200 text-secondary px-3 py-1 rounded-full font-semibold ml-1"
                        >
                            {topics[key as UUID]}
                            <Button
                                type="button"
                                className="bg-transparent text-red-500 text-lg"
                                onClick={() => handleRemove(key)}
                            >
                                x
                            </Button>
                        </Badge>
                    ))
                ) : (
                    <div></div>
                )}
            </div>
            <Input
                id="search"
                placeholder="Type to search..."
                value={query}
                onChange={handleSearch}
            />

            {/* Render results */}
            <ul className="mt-2 border rounded-md p-2 space-y-1 max-h-40 overflow-auto">
                {results.length > 0
                    ? results.map((item, idx) => (
                          <li
                              key={idx}
                              onClick={() => handleUpdate(item)}
                              className="p-1 hover:bg-gray-100 rounded"
                          >
                              {item}
                          </li>
                      ))
                    : query && <li className="text-gray-400">No results found</li>}
            </ul>
            <FieldDescription>Please search for the question topic.</FieldDescription>
        </div>
    );
}

interface FormProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>;
}

function QuestionForm(props: FormProp): JSX.Element {
    const { useCase } = useUseCase();
    const [openConfirm, setOpenConfirm] = useState<boolean>(false);
    const [formData, setFormData] = useState<FormData>({
        qnTitle: "",
        qnDesc: "",
        testCase: [{ input: "", output: "" }],
        qnImage: null,
        difficulty: Difficulty.EASY,
        qnTopics: [],
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestions = async () => {
            // Initialize form
            if (useCase == null) {
                setFormData((prev) => ({
                    ...prev,
                    qnTitle: "",
                    qnDesc: "",
                    testCase: [{ input: "", output: "" }],
                    qnImage: null,
                    difficulty: Difficulty.EASY,
                    qnTopics: [],
                }));
                setLoading(false);
                return;
            }
            const newQuestions = await getQuestion(useCase);
            if (newQuestions != null) {
                setFormData((prev) => ({
                    ...prev,
                    qnTitle: newQuestions.title,
                    qnDesc: newQuestions.description,
                    difficulty: newQuestions.difficulty as Difficulty,
                    qnTopics: newQuestions.topics,
                    testCase: newQuestions.testCase,
                }));
                DelayedDifficultyUpdate(newQuestions.difficulty);
            }

            setLoading(false);
        };
        fetchQuestions();
    }, []);
    if (loading) {
        return <div></div>;
    }

    function DelayedDifficultyUpdate(difficulty: string) {
        const timer = setTimeout(() => {
            const selectDifficulty = document.getElementById("difficulty") as HTMLSelectElement;
            selectDifficulty.value = difficulty;
        }, 500);

        return () => clearTimeout(timer);
    }

    function DelayedPageUpdate() {
        const timer = setTimeout(() => {
            props.toggler(true);
        }, 500);

        return () => clearTimeout(timer);
    }

    function handleDelete() {
        if (useCase == null) {
            return;
        }
        deleteQuestion(useCase);
        DelayedPageUpdate();
        return;
    }
    function handleSubmit() {
        if (useCase == null) {
            //create
            const data = JSON.stringify(formData);
            createQuestion(data);
        } else {
            //edit
            const data = JSON.stringify({
                quid: useCase,
                ...formData,
            });
            editQuestion(data);
        }

        DelayedPageUpdate();
    }

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSelectChange = (value: string) => {
        setFormData((prev) => ({ ...prev, difficulty: value as Difficulty }));
    };

    const handleTestCaseChange = (index: number, field: "input" | "output", value: string) => {
        setFormData((prev) => {
            const newTestCases = [...prev.testCase];
            newTestCases[index] = { ...newTestCases[index], [field]: value };
            return { ...prev, testCase: newTestCases };
        });
    };

    const addTestCase = () => {
        setFormData((prev) => ({
            ...prev,
            testCase: [...prev.testCase, { input: "", output: "" }],
        }));
    };

    const removeTestCase = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            testCase: prev.testCase.filter((_, i) => i !== index),
        }));
    };

    return (
        <div className="flex w-screen h-screen pt-8 flex-col">
            <header className="flex justify-between h-[10vh] px-[3%]">
                <button
                    onClick={() => props.toggler(true)}
                    className="bg-secondary text-white py-2 px-4 py-2 rounded-2xl font-medium"
                >
                    Back to questions
                </button>
            </header>
            <form action={handleSubmit} className="m-8">
                <FieldGroup>
                    <div className="ml-8 my-3">
                        <h2 className="font-bold text-3xl">Create New Question</h2>
                        <p>Fill in the details below to create a new question</p>
                    </div>

                    {/* Question title */}
                    <BorderedDiv>
                        <Field>
                            <FieldLabel htmlFor="qnTitle" className="font-bold">
                                Question Title
                            </FieldLabel>
                            <Textarea
                                id="qnTitile"
                                name="qnTitle"
                                className="border-2 border-grey-200 placeholder:text-grey-400"
                                rows={4}
                                placeholder="e.g. Two Sum Problem"
                                value={formData.qnTitle}
                                onChange={handleInputChange}
                            />
                        </Field>
                    </BorderedDiv>

                    {/* Description */}
                    <BorderedDiv>
                        <Field>
                            <FieldLabel htmlFor="qnDesc" className="font-bold">
                                Question Description
                            </FieldLabel>
                            <Textarea
                                id="qnDesc"
                                name="qnDesc"
                                className="border-2 border-grey-200 placeholder:text-grey-400"
                                rows={4}
                                placeholder="Describe the challenge in detail. Include the problem statement, constraints and any examples..."
                                value={formData.qnDesc}
                                onChange={handleInputChange}
                            />
                        </Field>
                    </BorderedDiv>

                    {/* Test cases */}
                    <BorderedDiv>
                        <div className="flex justify-between">
                            <FieldLegend className="font-bold">Test Cases</FieldLegend>
                            <Button
                                type="button"
                                className="bg-secondary hover:bg-secondary-700 text-white rounded-3xl px-4 py-6 "
                                onClick={() => {
                                    addTestCase();
                                }}
                            >
                                Add new test case
                            </Button>
                        </div>
                        {formData.testCase.map((tc, index) => (
                            <TestCases
                                key={index.toString() + "case"}
                                input={tc.input}
                                output={tc.output}
                                handleChange={(field, value) =>
                                    handleTestCaseChange(index, field, value)
                                }
                                handleRemove={() => removeTestCase(index)}
                            />
                        ))}
                    </BorderedDiv>

                    {/* Supporting Diagram */}
                    <BorderedDiv>
                        <Field>
                            <FieldLabel htmlFor="file" className="font-bold">
                                Supporting Diagram
                            </FieldLabel>
                            <Input
                                id="questionFile"
                                name="questionFile"
                                type="file"
                                className="border-2 border-grey-200 rounded-lg"
                            />
                            <FieldDescription>Select a file to upload.</FieldDescription>
                        </Field>
                    </BorderedDiv>

                    {/* Question Tag */}
                    <BorderedDiv>
                        <FieldLegend className="font-bold">Question Tag</FieldLegend>
                        <div className="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel htmlFor="difficulty" className="font-bold">
                                    Difficulty
                                </FieldLabel>
                                <Select
                                    defaultValue="Easy"
                                    value={formData.difficulty}
                                    onValueChange={handleSelectChange}
                                >
                                    <SelectTrigger
                                        id="difficulty"
                                        className="border-2 border-grey-200"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent
                                        position="popper"
                                        align="start"
                                        className="bg-grey-200 shadow-lg rounded-md w-[--radix-select-trigger-width] "
                                    >
                                        <SelectGroup>
                                            {Object.values(Difficulty).map((difficulty) => (
                                                <SelectItem key={difficulty} value={difficulty}>
                                                    {difficulty}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <TopicSearch
                                formTopics={formData.qnTopics}
                                updateFormTopics={setFormData}
                            />
                        </div>
                    </BorderedDiv>
                </FieldGroup>

                <FieldGroup className={`flex mb-8 py-6 px-8`}>
                    <Field
                        orientation="horizontal"
                        className={`${useCase == null ? "justify-end" : "justify-between"}`}
                    >
                        <Button
                            type="button"
                            className={`self-center  bg-secondary hover:bg-secondary-700 px-4 h-12 text-white rounded-3xl font-medium ${
                                useCase == null ? "hidden" : "block"
                            }`}
                            onClick={() => {
                                setOpenConfirm(true);
                            }}
                        >
                            Discard Question
                        </Button>
                        <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
                            <AlertDialogContent className="bg-white">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Are you sure you want to delete the question?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete
                                        the question from the database.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>

                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>

                                    <AlertDialogAction
                                        className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                                        onClick={() => {
                                            setOpenConfirm(false);
                                            handleDelete();
                                        }}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button
                            type="submit"
                            value="submit"
                            className="self-center  bg-secondary hover:bg-secondary-700 px-4 h-12 text-white rounded-3xl font-medium"
                        >
                            Submit
                        </Button>
                    </Field>
                </FieldGroup>
            </form>
        </div>
    );
}

export default QuestionForm;
