import { JSX, useEffect, useState } from "react";
import { Difficulty, FormData } from "./AdminType";
import { UUID } from "node:crypto";
import {
    createQuestion,
    deleteQuestion,
    editQuestion,
    getQuestion,
} from "@/services/admin/adminService";

import "./QuestionPageStyle.css";

interface ITestCase {
    input: string;
    output: string;
    handleChange: (field: "input" | "output", value: string) => void;
}

function TestCases(info: ITestCase) {
    return (
        <div style={{ display: "Flex", width: "100" }}>
            <div
                style={{
                    margin: "2rem",
                    border: "5px solid #F8F9FA",
                    borderRadius: "25px",
                    padding: "25px",
                    backgroundColor: "white",
                    flexGrow: "1",
                }}
            >
                <label style={{ fontWeight: "bold", display: "block" }}>Input</label>
                <textarea
                    style={{
                        border: "2px solid #E7E9EC",
                        borderRadius: "15px",
                        paddingLeft: "10px",
                        width: "100%",
                        paddingBottom: "50px",
                        lineHeight: "30px",
                        boxSizing: "border-box",
                    }}
                    id="input"
                    name="input"
                    placeholder="[0,1,2]"
                    value={info.input}
                    onChange={(e) => info.handleChange("input", e.target.value)}
                />
            </div>
            <div
                style={{
                    margin: "2rem",
                    border: "5px solid #F8F9FA",
                    borderRadius: "25px",
                    padding: "25px",
                    backgroundColor: "white",
                    flexGrow: "1",
                }}
            >
                <label style={{ fontWeight: "bold", display: "block" }}>Expected Output</label>
                <textarea
                    style={{
                        border: "2px solid #E7E9EC",
                        borderRadius: "15px",
                        paddingLeft: "10px",
                        width: "100%",
                        paddingBottom: "50px",
                        lineHeight: "30px",
                        boxSizing: "border-box",
                    }}
                    id="output"
                    name="output"
                    placeholder="3"
                    value={info.output}
                    onChange={(e) => info.handleChange("output", e.target.value)}
                />
            </div>
        </div>
    );
}

interface FormProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>;
    useCase: UUID | null;
}

function QuestionForm(props: FormProp): JSX.Element {
    const [discard, setDiscard] = useState<boolean>(false);
    const [formData, setFormData] = useState<FormData>({
        qnTitle: "",
        qnDesc: "",
        testCase: [{ input: "", output: "" }],
        qnImage: null,
        difficulty: Difficulty.EASY,
        qnTopics: "",
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestions = async () => {
            if (props.useCase == null) {
                setFormData((prev) => ({
                    ...prev,
                    qnTitle: "",
                    qnDesc: "",
                    testCase: [{ input: "", output: "" }],
                    qnImage: null,
                    difficulty: Difficulty.EASY,
                    qnTopics: "",
                }));
                setLoading(false);
                return;
            }
            const newQuestions = await getQuestion(props.useCase);
            if (newQuestions != null) {
                setFormData((prev) => ({
                    ...prev,
                    qnTitle: newQuestions.title,
                    qnDesc: newQuestions.description,
                    difficulty: newQuestions.difficulty as Difficulty,
                    qnTopics: newQuestions.topics.toString(),
                    testCase: newQuestions.testCase,
                }));
            }
            setLoading(false);
        };
        fetchQuestions();
    }, []);
    if (loading) {
        return <div></div>;
    }

    async function handleSubmit() {
        if (discard) {
            if (props.useCase == null) {
                setDiscard(false);
                props.toggler(true);
                return;
            }

            await deleteQuestion(props.useCase);
            setDiscard(false);
            props.toggler(true);
            return;
        }

        if (props.useCase == null) {
            const data = JSON.stringify(formData);
            createQuestion(data);
        } else {
            const data = JSON.stringify({
                quid: props.useCase,
                ...formData,
            });
            editQuestion(data);
        }

        props.toggler(true);
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

    const handleTestCaseChange = (index: number, field: "input" | "output", value: string) => {
        setFormData((prev) => {
            const newTestCases = [...prev.testCase];
            newTestCases[index] = { ...newTestCases[index], [field]: value };
            return { ...prev, testCase: newTestCases };
        });
    };

    return (
        <div
            style={{
                height: "100vh",
                width: "100vw",
                display: "flex",
                flexDirection: "column",
                paddingTop: "2em",
            }}
        >
            <header
                style={{
                    display: "flex",
                    height: "10vh",
                    justifyContent: "space-between",
                    padding: "0% 3%",
                }}
            >
                <button
                    onClick={() => props.toggler(true)}
                    style={{
                        background: "#5046E6",
                        padding: "0.5rem 1.1rem",
                        color: "white",
                        borderRadius: "1rem",
                        fontWeight: "500",
                    }}
                >
                    Back to questions
                </button>
                <button
                    onClick={() => props.toggler(true)}
                    style={{
                        background: "#5046E6",
                        padding: "0.5rem 1.1rem",
                        color: "white",
                        borderRadius: "1rem",
                        fontWeight: "500",
                    }}
                >
                    Publish question
                </button>
            </header>
            <form action={handleSubmit} style={{ margin: "2rem" }}>
                <div style={{ margin: "2rem 0rem", padding: "25px" }}>
                    <h2 style={{ fontWeight: "bold" }}>Create New Question</h2>
                    <p>Fill in the details below to create a new question</p>
                </div>

                {/* Question title */}
                <div className="sectionBorder">
                    <label style={{ fontWeight: "bold", display: "block" }}>Question Title</label>
                    <textarea
                        style={{
                            border: "2px solid #E7E9EC",
                            borderRadius: "15px",
                            paddingLeft: "10px",
                            width: "100%",
                            paddingBottom: "50px",
                            lineHeight: "30px",
                            boxSizing: "border-box",
                        }}
                        id="qnTitle"
                        name="qnTitle"
                        placeholder="e.g. Two Sum Problem"
                        value={formData.qnTitle}
                        onChange={handleInputChange}
                    />
                </div>

                {/* Description */}
                <div className="sectionBorder">
                    <label style={{ fontWeight: "bold", display: "block" }}>
                        Question Description
                    </label>
                    <textarea
                        style={{
                            border: "2px solid #E7E9EC",
                            borderRadius: "15px",
                            paddingLeft: "10px",
                            width: "100%",
                            paddingBottom: "50px",
                            lineHeight: "30px",
                            boxSizing: "border-box",
                        }}
                        id="qnDesc"
                        name="qnDesc"
                        placeholder="Describe the challenge in detail. Include the problem statement, constraints and any examples..."
                        value={formData.qnDesc}
                        onChange={handleInputChange}
                    />
                </div>

                {/* Test cases */}
                <div className="sectionBorder">
                    <p style={{ fontWeight: "bold", display: "block" }}>Test Cases</p>
                    {formData.testCase.map((tc, index) => (
                        <TestCases
                            key={index.toString() + "case"}
                            input={tc.input}
                            output={tc.output}
                            handleChange={(field, value) =>
                                handleTestCaseChange(index, field, value)
                            }
                        />
                    ))}
                </div>

                {/* Supporting Diagram */}
                <div className="sectionBorder">
                    <label style={{ fontWeight: "bold", display: "block" }}>
                        Supporting Diagram
                    </label>
                    <input
                        style={{
                            border: "2px solid #E7E9EC",
                            borderRadius: "15px",
                            paddingLeft: "10px",
                            width: "100%",
                        }}
                        type="file"
                        id="questionFile"
                        name="questionFile"
                    ></input>
                </div>

                {/* Question Tag */}
                <div className="sectionBorder">
                    <p style={{ fontWeight: "bold", display: "block" }}>Question Tag</p>
                    <div style={{ display: "Flex", width: "100" }}>
                        <div style={{ margin: "1rem", flexGrow: "1" }}>
                            <label style={{ fontWeight: "bold", display: "block" }}>Input</label>
                            <select
                                className="difficultySelect"
                                name="difficulty"
                                style={{
                                    border: "5px solid #F8F9FA",
                                    borderRadius: "25px",
                                    padding: "10px 25px",
                                    backgroundColor: "white",
                                    width: "100%",
                                }}
                                onChange={handleInputChange}
                            >
                                {Object.values(Difficulty).map((difficulty) => (
                                    <option key={difficulty} value={difficulty}>
                                        {difficulty}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ margin: "1rem", flexGrow: "1" }}>
                            <label style={{ fontWeight: "bold", display: "block" }}>
                                Question Topics
                            </label>
                            <textarea
                                style={{
                                    border: "2px solid #E7E9EC",
                                    borderRadius: "15px",
                                    paddingLeft: "10px",
                                    width: "100%",
                                    paddingBottom: "5px",
                                    lineHeight: "30px",
                                    boxSizing: "border-box",
                                }}
                                id="qnTopics"
                                name="qnTopics"
                                placeholder="Describe the challenge in detail. Include the problem statement, constraints and any examples..."
                                value={formData.qnTopics}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "2em",
                        padding: "25px",
                    }}
                >
                    <button
                        style={{
                            background: "#5046E6",
                            padding: "0.5rem 1.1rem",
                            color: "white",
                            borderRadius: "1rem",
                            fontWeight: "500",
                        }}
                        onClick={() => {
                            setDiscard(true);
                        }}
                    >
                        Discard Question
                    </button>
                    <input
                        style={{
                            background: "#5046E6",
                            padding: "0.5rem 1.1rem",
                            color: "white",
                            borderRadius: "1rem",
                            fontWeight: "500",
                        }}
                        type="submit"
                        value="Submit"
                    />
                </div>
            </form>
        </div>
    );
}

export default QuestionForm;
