import { useState } from "react";

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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { ErrorPopupInfo, TopicInfo } from "@/models/question/questionType";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import { useTopics } from "@/context/useTopic";
import { createTopic, deleteTopic, editTopic } from "@/services/question/topicService";

export function TopicEdit() {
    const { topics, refreshTopics, fullTopicInfo } = useTopics();
    //const [topicInfos, updateTopicInfos] = useState<TopicInfo[]>([]);
    const [topicInfos, updateTopicInfos] = useState<TopicInfo[]>(() => {
        if (!topics) return [];
        return Object.entries(topics).map(([tid, topic]) => ({
            tid: tid as UUID,
            topic,
        }));
    });
    // const [initialized, setInitialized] = useState(false);
    const [openConfirm, setOpenConfirm] = useState<boolean>(false);
    const [target, setTarget] = useState<UUID | null>(null);
    const [openForm, setOpenForm] = useState<boolean>(false);
    const [errorPopup, setErrorPopup] = useState<ErrorPopupInfo>({ showPopup: false, error: "" });

    const handleTopicChange = (index: number, value: string) => {
        if (value === "") {
            updateTopicInfos((prev) => {
                const newEdit = [...prev];
                newEdit[index] = { ...newEdit[index], topic: value };
                return newEdit;
            });
            return;
        }

        if (!/[a-zA-Z -]/.test(value.charAt(value.length - 1))) return;
        updateTopicInfos((prev) => {
            const newEdit = [...prev];
            newEdit[index] = { ...newEdit[index], topic: value };
            return newEdit;
        });
    };

    const addTopic = () => {
        updateTopicInfos((prev) => [...prev, { tid: null, topic: "" }]);
    };

    function displayErrorPopup(error: string) {
        setErrorPopup({ showPopup: true, error: error });
    }

    function hasDuplicates() {
        const seenTopics = new Set();

        for (let i = 0; i < topicInfos.length; i++) {
            const topicName = topicInfos[i].topic.trim();

            if (topicName.length !== 0) {
                if (seenTopics.has(topicName)) {
                    return true;
                } else {
                    seenTopics.add(topicName);
                }
            }
        }

        return false;
    }

    async function saveChanges() {
        const invalidEdits: TopicInfo[] = topicInfos.filter(
            (item) => item.topic.trim().length == 0 && item.tid !== null,
        );
        if (invalidEdits.length > 0) {
            displayErrorPopup("You cannot have blank topics");
            return;
        }

        const duplicateTopics = hasDuplicates();
        
        if (duplicateTopics) {
            displayErrorPopup("You cannot have duplicate topic names");
            return;
        }

        //Remove blanks
        const validTopics: TopicInfo[] = topicInfos.filter(
            (item) => item.topic.trim().length !== 0,
        );

        //Get all those that have edited
        const changedTopicNames: TopicInfo[] = validTopics.filter((item) => {
            if (item.tid == null || !(item.tid in topics!)) return false;
            return topics![item.tid] !== undefined && topics![item.tid] != item.topic;
        });
        if (changedTopicNames.length > 0) {
            const detailedChanged = fullTopicInfo.filter((topicInfo) =>
                changedTopicNames.some((changed) => changed.tid === topicInfo.tid),
            );

            const detailedChangedUpdate = detailedChanged.map((topicInfo) => {
                const mappedTopic = changedTopicNames.find(
                    (changed) => changed.tid === topicInfo.tid,
                );
                return { ...topicInfo, topic: mappedTopic!.topic };
            });

            const result = await editTopic(detailedChangedUpdate);
            if (result !== 200) {
                displayErrorPopup("Topic edits cannot be saved, please try again.");
            }
        }

        //Get the newly added topics
        const newTopics = validTopics.filter((item) => item.tid == null);
        if (newTopics.length > 0) {
            const result = await createTopic(newTopics);
            if (result !== 200) {
                displayErrorPopup("Topic edits cannot be saved, please try again.");
            }
        }

        updateTopicInfos(validTopics);

        refresh();
    }

    function DelayedPageUpdate() {
        const timer = setTimeout(() => {
            setOpenForm(false);
        }, 500);

        return () => clearTimeout(timer);
    }

    async function refresh() {
        await refreshTopics();

        DelayedPageUpdate();
    }

    function RemoveTopic(index: number) {
        //for visual remove
        updateTopicInfos((prev) => prev.filter((_, i) => i !== index));
    }

    async function DeleteTopic() {
        //really delete
        if (target == null) return;
        const backup: TopicInfo | undefined = topicInfos.find((item) => item.tid === target);
        updateTopicInfos((prev) => prev.filter((item) => item.tid !== target));
        const result = await deleteTopic(target as UUID);

        if (result !== 200 && backup !== undefined) {
            updateTopicInfos((prev) => [...prev, backup]);
            displayErrorPopup(
                "There are questions that are solely dependent on this topic. Please edit them and try again.",
            );
            setOpenForm(false);
        }
    }

    if (topics == null) {
        return <div>Apologies, an error has occurred</div>;
    }

    return (
        <>
            <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you sure you want to delete the topic: {topics[target as UUID]}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the topic and
                            all associated question tags in the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>

                        <AlertDialogAction
                            className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                            onClick={() => {
                                setOpenConfirm(false);
                                DeleteTopic();
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={errorPopup.showPopup}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Error:</AlertDialogTitle>
                        <AlertDialogDescription>{errorPopup.error}</AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setErrorPopup({ showPopup: false, error: "" })}
                        >
                            Close
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={openForm}>
                <DialogTrigger
                    onClick={() => setOpenForm(true)}
                    className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                >
                    Edit
                </DialogTrigger>
                <DialogContent
                    className="[&>button]:hidden  bg-white"
                    style={{ display: openConfirm ? "none" : "grid" }}
                >
                    <DialogHeader>
                        <DialogTitle>Topic Editor</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Scroll to find and edit the topics here and click the "Save changes" button
                        to save your changes.
                    </DialogDescription>
                    <form className="flex gap-2 flex-col max-h-80 overflow-auto">
                        {topicInfos !== undefined ? (
                            topicInfos.map((item, index) => (
                                <div
                                    key={"topic" + item.tid + index}
                                    className="flex justify-between"
                                >
                                    <Input
                                        value={item.topic}
                                        placeholder=""
                                        onChange={(e) => handleTopicChange(index, e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        className="bg-secondary-200 text-secondary hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                                        onClick={() =>
                                            item.tid == null
                                                ? (setTarget(item.tid), RemoveTopic(index))
                                                : (setTarget(item.tid), setOpenConfirm(true))
                                        }
                                    >
                                        Delete
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div></div>
                        )}
                    </form>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                            onClick={() => addTopic()}
                        >
                            Add Topic
                        </Button>
                        <Button
                            type="button"
                            className="bg-secondary text-white hover:bg-primary-200 px-3 py-1 rounded-full font-semibold ml-1"
                            onClick={() => saveChanges()}
                        >
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default TopicEdit;
