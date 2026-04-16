// Reference:
// - https://stackoverflow.com/questions/78401672/how-to-hide-the-x-at-the-top-of-the-shadcn-dialog-box
// to hide dialog box default x.

import { ChangeEvent, JSX, useEffect, useMemo, useState } from "react";

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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogTitle,
} from "@/components/ui/dialog";
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

import { pushToast } from "@/utils/toast";

import { Difficulty, FormData } from "../../models/question/questionType";
import { Badge } from "../ui/badge";
import { BorderedDiv } from "../ui/bordered-div";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";

import { useTopics, useUseCase } from "@/context/useTopic";
import {
    createQuestion,
    deleteQuestion,
    editQuestion,
    getQuestion,
    imageUpload,
} from "@/services/question/questionService";

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
                        required={true}
                        id="input"
                        name="input"
                        placeholder="e.g. [2, 7] or [[1,2,3]] for a single array arg"
                        value={info.input}
                        onChange={(e) => info.handleChange("input", e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border-2 border-grey-200 pl-[10px] leading-[30px] placeholder:text-grey-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Valid JSON. Array elements become separate arguments.
                    </p>
                </Field>
            </div>
            <div className="m-8 bg-white flex-grow">
                <Field>
                    <FieldLabel htmlFor="input" className="font-bold text-md">
                        Expected Output
                    </FieldLabel>

                    <Textarea
                        required={true}
                        id="output"
                        name="output"
                        placeholder={'e.g. 9 or "hello" or [1, 2, 3]'}
                        value={info.output}
                        onChange={(e) => info.handleChange("output", e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border-2 border-grey-200 pl-[10px] leading-[30px] placeholder:text-grey-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Valid JSON return value. Strings must be quoted: "hello" not hello
                    </p>
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

    const topicPool = useMemo(() => {
        if (!topics) return {};
        return Object.fromEntries(
            Object.entries(topics as Record<UUID, string>).map(([key, value]) => [value, key]),
        ) as Record<string, UUID>;
    }, [topics]);

    const searchSpace = useMemo(() => {
        if (!topics) return [];

        return Object.entries(topics)
            .filter(([id]) => !props.formTopics.includes(id as UUID))
            .map(([_, name]) => name);
    }, [topics, props.formTopics]);

    const results = useMemo(() => {
        return Object.values(searchSpace).filter((topicName) =>
            topicName.toLowerCase().includes(query.toLowerCase()),
        );
    }, [searchSpace, query]);

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
    };

    const handleUpdate = (topic: string) => {
        props.updateFormTopics((prev) => ({
            ...prev,
            qnTopics: [...prev.qnTopics, topicPool[topic] as UUID],
        }));
    };

    const handleRemove = (topic: UUID) => {
        props.updateFormTopics((prev) => {
            const updatedTopics = prev.qnTopics.filter((item) => item !== topic);
            return {
                ...prev,
                qnTopics: updatedTopics,
            };
        });
    };

    if (!topics) return <div>Error, please reload</div>;
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
    const [file, setFile] = useState<File | null>(null);
    const [removeOldImage, setRemoveOldImage] = useState<boolean>(false);
    const allowedFileTypes = ["image/jpeg", "image/png"];
    const { useCase } = useUseCase();
    const [openConfirm, setOpenConfirm] = useState<boolean>(false);
    const [formData, setFormData] = useState<FormData>({
        qnTitle: "",
        qnDesc: "",
        testCase: [{ input: "", output: "" }],
        qnImage: null,
        difficulty: Difficulty.EASY,
        qnTopics: [],
        version: 1,
    });

    const [loading, setLoading] = useState(true);
    const [isUploading, setUploading] = useState(false);
    const [isDisplayError, setDisplayError] = useState(false);

    const [imageError, setImageError] = useState<string>("");

    function DelayedDifficultyUpdate(difficulty: string) {
        const timer = setTimeout(() => {
            const selectDifficulty = document.getElementById("difficulty") as HTMLSelectElement;
            selectDifficulty.value = difficulty;
        }, 500);

        return () => clearTimeout(timer);
    }

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
                    version: 1,
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
                    qnImage: newQuestions.qnImage,
                    version: newQuestions.version,
                }));

                DelayedDifficultyUpdate(newQuestions.difficulty);
            }

            setLoading(false);
        };
        fetchQuestions();
    }, [useCase]);
    if (loading) {
        return <div></div>;
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

    function submitData() {
        if (
            formData.qnTopics.length == 0 ||
            formData.testCase.length == 0 ||
            (file !== null && file.size > 1024 * 1024)
        ) {
            pushToast({
                tone: "error",
                message:
                    formData.qnTopics.length == 0
                        ? "Question must have at least one topic"
                        : formData.testCase.length == 0
                          ? "Question must have at least one test case"
                          : "Uploaded image have exceeded the amximum allowed file size",
            });
            return;
        }
        setUploading(true);
        handleSubmit();
    }
    async function handleSubmit() {
        const finalFormData: FormData = { ...formData };

        if (file !== null) {
            const result = await imageUpload(file);
            if (result == undefined) {
                setUploading(false);
                setDisplayError(true);
                return;
            }

            finalFormData.qnImage = result;
        } else if (useCase == null || removeOldImage) {
            finalFormData.qnImage = null;
        } else if (typeof formData.qnImage === "string") {
            const start = formData.qnImage.indexOf("uploads");
            const end = formData.qnImage.indexOf("?");
            const result = formData.qnImage?.substring(start, end);
            finalFormData.qnImage = result;
        }

        if (useCase == null) {
            //create
            const data = JSON.stringify(finalFormData);
            const feedback = await createQuestion(data);
            if (feedback == 200) {
                DelayedPageUpdate();
            } else {
                setUploading(false);
                setDisplayError(true);
            }
        } else {
            //edit
            const data = JSON.stringify({
                quid: useCase,
                ...finalFormData,
            });
            const feedback = await editQuestion(data);
            if (feedback == 200) {
                DelayedPageUpdate();
            } else {
                setUploading(false);
                setDisplayError(true);
            }
        }
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

    const setImage = (e: ChangeEvent<HTMLInputElement>) => {
        const image = e.target.files?.[0];
        if (image == undefined) return;

        if (!allowedFileTypes.includes(image.type)) {
            (document.getElementById("questionFile") as HTMLInputElement).value = "";
            setImageError("Error: File not supported. Only png and jpg are accepted.");
            return;
        }

        if (image.size > 1024 * 1024) {
            (document.getElementById("questionFile") as HTMLInputElement).value = "";
            setImageError("Error: File size exceeded maximum size allowed.");
            return;
        }
        setFile(image || null);
        setImageError("");
    };

    const removeImage = () => {
        setFile(null);
        (document.getElementById("questionFile") as HTMLInputElement).value = "";
        setImageError("");
    };

    return (
        <div className="flex w-screen h-screen pt-8 flex-col">
            <Dialog open={isDisplayError} onOpenChange={setDisplayError}>
                <DialogOverlay>
                    <DialogContent className="flex flex-col items-center bg-white">
                        <DialogTitle>A conflict has occurred</DialogTitle>
                        <DialogDescription className="text-center">
                            This question may have been updated elsewhere by another admin.
                            Alternatively, you might have created a question previously with the
                            same title. Please note that duplicated question title is not allowed.
                            Please reload the form to get the latest version, or rename the title,
                            before trying again.
                        </DialogDescription>
                    </DialogContent>
                </DialogOverlay>
            </Dialog>
            <Dialog open={isUploading} onOpenChange={setUploading}>
                <DialogOverlay>
                    <DialogContent className="[&>button]:hidden flex flex-col items-center bg-white">
                        <DialogTitle>Saving changes, please wait...</DialogTitle>
                        <Spinner className="size-6" />
                    </DialogContent>
                </DialogOverlay>
            </Dialog>

            <header className="flex justify-between h-[10vh] px-[3%]">
                <button
                    onClick={() => props.toggler(true)}
                    className="bg-secondary text-white py-2 px-4 py-2 rounded-2xl font-medium"
                >
                    Back to questions
                </button>
            </header>
            <form action={submitData} className="m-8">
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
                                required={true}
                                id="qnTitle"
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
                                required={true}
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
                        <details
                            open
                            className="mt-3 mb-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700"
                        >
                            <summary className="cursor-pointer font-medium text-gray-600 select-none">
                                How to format test cases
                            </summary>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        Input (function arguments)
                                    </p>
                                    <ul className="mt-1 ml-4 list-disc space-y-1 text-gray-600">
                                        <li>
                                            Must be <strong>valid JSON</strong>
                                        </li>
                                        <li>
                                            Each array element becomes a separate argument:{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                [2, 7]
                                            </code>{" "}
                                            calls{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                fn(2, 7)
                                            </code>
                                        </li>
                                        <li>
                                            To pass a single array as one argument,{" "}
                                            <strong>double-wrap</strong> it:{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                [[1,2,3]]
                                            </code>{" "}
                                            calls{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                fn([1,2,3])
                                            </code>
                                        </li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        Expected Output (return value)
                                    </p>
                                    <ul className="mt-1 ml-4 list-disc space-y-1 text-gray-600">
                                        <li>
                                            Must be <strong>valid JSON</strong>
                                        </li>
                                        <li>
                                            Strings must be quoted:{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                "10101"
                                            </code>{" "}
                                            not{" "}
                                            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                                10101
                                            </code>
                                        </li>
                                        <li>Compared via JSON deep equality</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">Examples</p>
                                    <div className="mt-1 overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-300 text-left text-gray-500">
                                                    <th className="pb-1 pr-3 font-medium">Input</th>
                                                    <th className="pb-1 pr-3 font-medium">Output</th>
                                                    <th className="pb-1 font-medium">Meaning</th>
                                                </tr>
                                            </thead>
                                            <tbody className="font-mono">
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-1 pr-3">[2, 7]</td>
                                                    <td className="py-1 pr-3">9</td>
                                                    <td className="py-1 font-sans text-gray-500">
                                                        2 args: numbers
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-1 pr-3">
                                                        [["h","e","l","l","o"]]
                                                    </td>
                                                    <td className="py-1 pr-3">
                                                        ["o","l","l","e","h"]
                                                    </td>
                                                    <td className="py-1 font-sans text-gray-500">
                                                        1 arg: array (double-wrapped)
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-1 pr-3">["1010", "1011"]</td>
                                                    <td className="py-1 pr-3">"10101"</td>
                                                    <td className="py-1 font-sans text-gray-500">
                                                        2 args: strings; output is a string
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="py-1 pr-3">[3]</td>
                                                    <td className="py-1 pr-3">2</td>
                                                    <td className="py-1 font-sans text-gray-500">
                                                        1 arg: number
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </details>
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
                            {formData.qnImage && !removeOldImage && (
                                <div className="flex">
                                    <img src={formData.qnImage} alt="question" />
                                    <Button
                                        type="button"
                                        className="bg-transparent text-red-500 text-lg"
                                        onClick={() => setRemoveOldImage(true)}
                                    >
                                        x
                                    </Button>
                                </div>
                            )}
                            <div className="flex">
                                <Input
                                    id="questionFile"
                                    name="questionFile"
                                    type="file"
                                    className="border-2 border-grey-200 rounded-lg"
                                    onChange={(e) => setImage(e)}
                                />
                                <Button
                                    type="button"
                                    className="bg-transparent text-red-500 text-lg"
                                    style={{ display: file == null ? "none" : "inline" }}
                                    onClick={() => removeImage()}
                                >
                                    x
                                </Button>
                            </div>

                            <FieldDescription>
                                Select a file to upload. Please note that only png and jpeg are
                                accepted with a maximum file size allowed of 1MB.
                            </FieldDescription>
                            <FieldDescription
                                style={{
                                    color: "red",
                                }}
                            >
                                {imageError}
                            </FieldDescription>
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
