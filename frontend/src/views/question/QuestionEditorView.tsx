import { useEffect, useState } from "react";

import { UUID } from "crypto";

import { BorderedDiv } from "@/components/question/QuestionComponents";
import QuestionSearch from "@/components/question/QuestionSearchComponent";
import TopicEdit from "@/components/question/TopicForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Difficulty, LeetcodeInfo, QuestionInfo } from "@/models/question/questionType";

import { useTopics, useUseCase } from "@/context/useTopic";
import {
    getLeetcodeQuestions,
    getPopularQuestions,
    getQuestions,
} from "@/services/question/questionService";

interface QuestionProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>;
    questionDetails: QuestionInfo;
}

function Question(props: QuestionProp) {
    const { setUseCase } = useUseCase();
    const { topics } = useTopics();
    if (topics == null) return <div></div>;
    return (
        <div
            key={props.questionDetails.title}
            className="flex justify-between bg-[#F9FAFB] p-2.5 rounded-[15px] my-2"
        >
            <div className="flex grow-[3] content-center">
                <p className="font-bold self-center">{props.questionDetails.title}</p>
                {props.questionDetails.topics.map((topic) => (
                    <Badge
                        key={props.questionDetails.title + topic}
                        className="bg-secondary-200 text-secondary px-3 py-1 rounded-full font-semibold ml-1"
                    >
                        {topics[topic]}
                    </Badge>
                ))}
            </div>
            <div className="flex grow justify-end content-center">
                <p
                    style={{
                        textAlign: "right",
                        alignSelf: "center",
                        color:
                            props.questionDetails.difficulty == Difficulty.EASY
                                ? "green"
                                : props.questionDetails.difficulty == Difficulty.MEDIUM
                                  ? "#F9A93F"
                                  : "red",
                    }}
                >
                    {props.questionDetails.difficulty}
                </p>
                <Button
                    onClick={() => {
                        setUseCase(props.questionDetails.quid);
                        props.toggler(false);
                    }}
                    className="bg-secondary-200 text-secondary hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                >
                    Edit
                </Button>
            </div>
        </div>
    );
}

interface LeetcodeProp {
    questionDetails: LeetcodeInfo;
}

function LeetcodeQuestion(props: LeetcodeProp) {
    return (
        <div
            key={props.questionDetails.quid}
            className="flex justify-between bg-[#F9FAFB] p-2.5 rounded-[15px] my-2"
        >
            <div className="flex grow-[3] content-center">
                <a
                    className="hover:text-secondary font-bold self-center"
                    href={"https://leetcode.com/problems/" + props.questionDetails.title_slug}
                    target="_blank"
                    referrerPolicy="no-referrer"
                >
                    {props.questionDetails.title}
                </a>

                {props.questionDetails.topics.map((topic) => (
                    <Badge
                        key={props.questionDetails.title + topic}
                        className="bg-secondary-200 text-secondary px-3 py-1 rounded-full font-semibold ml-1"
                    >
                        {topic}
                    </Badge>
                ))}
            </div>
            <div className="flex grow justify-end content-center">
                <p
                    className="self-right text-right"
                    style={{
                        color:
                            props.questionDetails.difficulty == Difficulty.EASY
                                ? "green"
                                : props.questionDetails.difficulty == Difficulty.MEDIUM
                                  ? "#F9A93F"
                                  : "red",
                    }}
                >
                    {props.questionDetails.difficulty}
                </p>
            </div>
        </div>
    );
}

interface AdminProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>;
}

function Admin(props: AdminProp) {
    const { setUseCase } = useUseCase();
    const [questions, setQuestions] = useState<QuestionInfo[]>([]);
    const [backupQuestions, setBackup] = useState<QuestionInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const [popularQuestions, setPopularQuestions] = useState<string[]>([]);
    const [leetcodeQuestions, setLeetcodeQuestions] = useState<LeetcodeInfo[]>([]);
    const { topics } = useTopics();

    useEffect(() => {
        const fetchQuestions = async () => {
            const newQuestions = await getQuestions();

            //get questions
            if (newQuestions != null) {
                setQuestions(newQuestions);
                setBackup(newQuestions);
            }

            //get popular questions
            const popular = await getPopularQuestions();
            if (popular != null) {
                setPopularQuestions(popular);
            }
            //get leetcode questions
            const leetcode = await getLeetcodeQuestions();
            if (leetcode != null) {
                setLeetcodeQuestions(leetcode);
            }

            setLoading(false);
        };
        fetchQuestions();
    }, [props.toggler]);

    function revertDefault() {
        setQuestions(backupQuestions);
    }
    if (loading) {
        return <div>Loading</div>;
    }

    return (
        <div className="flex h-screen w-screen flex-col">
            <header className="flex h-[10vh] justify-between px-8">
                <div className="flex self-center">
                    <div
                        className="bg-secondary text-white"
                        style={{
                            width: "30px",
                            height: "30px",
                            margin: "10px",
                            textAlign: "center",
                        }}
                    >
                        <span>{"</>"}</span>
                    </div>
                    <h1
                        style={{
                            display: "inline",
                            marginLeft: "5px",
                            alignSelf: "center",
                            fontWeight: "bold",
                            margin: "0",
                        }}
                    >
                        Peer2Prep
                    </h1>
                </div>
                <div className="flex">
                    <a
                        href="/account/profile"
                        className="self-center bg-secondary hover:bg-secondary-700 px-[1.1rem] py-2 text-white rounded-2xl font-medium m-[10px] no-underline"
                    >
                        Back to profile
                    </a>
                </div>
            </header>
            <div
                style={{
                    backgroundColor: "#F9FAFB",
                    flexGrow: "1",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Banner */}
                <div className="flex justify-between p-8">
                    <h2 className="inline font-bold text-4xl">Welcome back, Admin!</h2>
                    <Button
                        className="bg-secondary hover:bg-secondary-700 text-white rounded-3xl px-4 py-6 text-lg"
                        onClick={() => {
                            setUseCase(null);
                            props.toggler(false);
                        }}
                    >
                        Add New Question
                    </Button>
                </div>

                {/* Question View */}
                <BorderedDiv>
                    <div className="flex">
                        <h3 className="font-bold pr-10">Question List</h3>
                        <QuestionSearch
                            updateQuestionList={setQuestions}
                            revertDefault={revertDefault}
                        />
                    </div>

                    <div>
                        {questions.map((question, index) => (
                            <Question
                                key={index.toString() + question}
                                questionDetails={question}
                                toggler={props.toggler}
                            />
                        ))}
                    </div>
                </BorderedDiv>

                {/* Topic View */}
                <BorderedDiv>
                    <h3 className="font-bold">Topic List</h3>
                    <div className="flex">
                        <div className="grow-[9]">
                            {topics !== null ? (
                                Object.keys(topics).map((key) => (
                                    <Badge
                                        key={key}
                                        className="bg-secondary-200 text-secondary px-3 py-1 rounded-full font-semibold ml-1"
                                    >
                                        {topics[key as UUID]}
                                        {/* <Button>x</Button> */}
                                    </Badge>
                                ))
                            ) : (
                                <div></div>
                            )}
                        </div>
                        <TopicEdit />
                    </div>
                </BorderedDiv>

                {/* Additional */}
                <div className="flex m-8 gap-5">
                    <BorderedDiv className="m-0 box-content flex-grow-[3]">
                        <h3 className="font-bold">Questions you might like to add</h3>
                        <div>
                            {leetcodeQuestions.map((question, index) => (
                                <LeetcodeQuestion
                                    key={index.toString() + question}
                                    questionDetails={question}
                                />
                            ))}
                        </div>
                    </BorderedDiv>
                    <div className="grow bg-secondary text-white rounded-3xl p-[25px]">
                        <h3 className="font-bold">Popular Questions</h3>
                        <div>
                            {popularQuestions.map((question, index) => (
                                <p key={"pop" + index.toString()}>{`${index + 1}. ${question}`}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Admin;
