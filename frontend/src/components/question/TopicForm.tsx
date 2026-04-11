import { useEffect, useState } from "react";

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

import { TopicInfo } from "@/models/question/questionType";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import { useTopics } from "@/context/useTopic";
import { createTopic, deleteTopic, editTopic } from "@/services/question/topicService";

export function TopicEdit() {
    const { topics, refreshTopics } = useTopics();
    const [topicInfos, updateTopicInfos] = useState<TopicInfo[]>([]);
    const [openConfirm, setOpenConfirm] = useState<boolean>(false);
    const [target, setTarget] = useState<UUID | null>(null);
    const [openForm, setOpenForm] = useState<boolean>(false);
    if (topics == null) {
        return <div>Apologies, an error has occurred</div>;
    }

    useEffect(() => {
        if (topics == null) return;
        const initTopicInfo: TopicInfo[] = Object.entries(topics).map(([tid, topic]) => {
            return { tid: tid as UUID, topic };
        });
        if (initTopicInfo.length > 0) {
            updateTopicInfos(initTopicInfo);
        }
    }, []);

    const handleTopicChange = (index: number, value: string) => {
        if (!/[a-zA-Z ]/.test(value.charAt(value.length - 1))) return;
        updateTopicInfos((prev) => {
            const newEdit = [...prev];
            newEdit[index] = { ...newEdit[index], topic: value };
            return newEdit;
        });
    };

    const addTopic = () => {
        updateTopicInfos((prev) => [...prev, { tid: null, topic: "" }]);
    };

    function saveChanges() {
        //Get all those that have edited
        const changedTopicNames: TopicInfo[] = topicInfos.filter((item) => {
            if (item.tid == null || !(item.tid in topics!)) return false;
            return topics![item.tid] !== undefined && topics![item.tid] != item.topic;
        });
        if (changedTopicNames.length > 0) {
            editTopic(changedTopicNames);
        }

        //Get the newly added topics
        const newTopics = topicInfos.filter((item) => item.tid == null);
        if (newTopics.length > 0) {
            createTopic(newTopics);
        }

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

    function DeleteTopic() {
        //really delete
        if (target == null) return;
        updateTopicInfos((prev) => prev.filter((_, i) => topicInfos[i].tid !== target));
        deleteTopic(target as UUID);
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
