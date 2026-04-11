import React, { useEffect, useRef, useState } from "react";

import { MessageSquareText, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";

interface MessageInfo {
    type: string;
    message: string;
    messageId: string;
    replyMessage: string | null;
    from?: string;
}
// const testUser: string = Math.floor(Math.random() * 100).toString();

type MessageInfoType = {
    message: string;
    messageId: string;
    replyMessage: string | null;
    isSelf: boolean;
    quote: () => void;
};

function UserMessage(prop: MessageInfoType) {
    return (
        <div className={`flex ${prop.isSelf ? "justify-end" : "justify-start"}`}>
            <div
                className={`
                relative
                max-w-xs
                px-[7px] py-[2px]
                my-[5px]
                rounded-md
                ${prop.isSelf ? "bg-[#93C5FD]" : "bg-white"}

                after:content-['']
                after:absolute
                after:top-[-10px]
                after:border-[10px]
                after:border-solid
                after:border-r-transparent
                after:border-b-transparent
                after:border-l-transparent

                ${
                    prop.isSelf
                        ? "after:right-[-4px] after:border-t-[#93C5FD] after:rotate-[135deg]"
                        : "after:left-[-4px] after:border-t-white after:rotate-[-135deg]"
                }
                `}
            >
                <div
                    id={prop.messageId}
                    className={`rounded-md w-fit px-[7px] py-[2px] my-[5px] ${prop.isSelf ? "bg-[#93C5FD]" : "bg-white"}`}
                >
                    <ContextMenu>
                        <ContextMenuTrigger className="flex flex-col w-fit max-w-xs items-start justify-start rounded-xl text-sm whitespace-pre-wrap">
                            {prop.replyMessage && (
                                <p
                                    className={`line-clamp-2 italic pl-[3px] ml-0 border-l-4
                                        ${
                                            prop.isSelf
                                                ? "bg-[#7DBBFF] border-white"
                                                : "bg-[#F7F7F7] border-[#93C5FD]"
                                        }`}
                                >
                                    {prop.replyMessage}
                                </p>
                            )}
                            <p className="text-black">{prop.message}</p>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 bg-white w-fit">
                            <ContextMenuGroup>
                                <ContextMenuItem onClick={() => prop.quote()}>
                                    Reply
                                </ContextMenuItem>
                            </ContextMenuGroup>
                        </ContextMenuContent>
                    </ContextMenu>
                </div>
            </div>
        </div>
    );
}

const CollaborationChat: React.FC<{ collaborationId: string | undefined; userId: string }> = ({
    collaborationId,
    userId,
}) => {
    const [message, setMessage] = useState<string>("");
    const [chatMessages, setChatMessages] = useState<MessageInfo[]>([]);
    const [chatIds, setChatIds] = useState<Set<string>>(new Set());

    const [quoteMessage, setQuoted] = useState<MessageInfo | null>(null);

    const socket = useRef<WebSocket | null>(null);
    // Establish WebSocket connection
    useEffect(() => {
        const ws = new WebSocket("ws://localhost:3019");
        socket.current = ws;

        ws.onopen = () => {
            // Join the collaboration room with userId and collaborationId
            ws.send(
                JSON.stringify({
                    type: "join",
                    messageId: crypto.randomUUID(),
                    collaborationId,
                    userId,
                    // testUser,
                }),
            );
        };

        ws.onmessage = (event) => {
            const data: MessageInfo = JSON.parse(event.data);

            if (data.type === "info") {
                // console.log(data.message);
            } else {
                // console.log(event.data);
                if (chatIds.has(data.messageId)) return;
                setChatMessages((prevMessages) => [...prevMessages, data]);
                setChatIds((prevId) => prevId.add(data.messageId));
            }
        };

        // setSocket(ws);

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [collaborationId, userId]);

    // Send a message to the collaboration room
    const sendMessage = () => {
        if (socket && message) {
            const messageId = crypto.randomUUID();
            const stringed = JSON.stringify({
                type: "private_message",
                collaborationId,
                userId,
                // testUser,
                text: message,
                replyMessage: quoteMessage == null ? null : quoteMessage.message,
                messageId: messageId,
            });
            socket.current?.send(stringed);
            setMessage("");
            setChatMessages((prevMessages) => [
                ...prevMessages,
                {
                    type: "private_message",
                    messageId: messageId,
                    message: message,
                    replyMessage: quoteMessage == null ? null : quoteMessage.message,
                    from: userId.toString(),
                    // from: testUser.toString(),
                },
            ]);

            setQuoted(null);
        }
    };

    const quotingMessage = (message: MessageInfo) => {
        setQuoted(message);
    };

    const handleEnterSend = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // stop newline
            sendMessage();
        }
    };

    return (
        <div className="bg-[#0b1120] flex flex-col">
            {/* Title */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 w-full">
                <div className="flex items-center gap-3">
                    <MessageSquareText className="size-5 text-blue-300" />
                    <h2 className="text-2xl font-semibold text-white">Chat</h2>
                </div>
                <p className="text-sm text-slate-400">Live collaboration shell</p>
            </div>

            {/* Chat */}
            <div className="h-[150px] overflow-y-auto p-[15px] w-full">
                {chatMessages.map((msg, index) => (
                    <UserMessage
                        key={index}
                        message={msg.message}
                        messageId={msg.messageId}
                        replyMessage={msg.replyMessage}
                        quote={() => quotingMessage(msg)}
                        isSelf={msg.from == userId.toString()}
                    />
                ))}
            </div>

            {/* Send message */}
            <div className="flex items-end gap-3 w-full px-2 shrink-0">
                <div className="relative flex-grow">
                    {quoteMessage && (
                        <div className="absolute left-0 right-0 bottom-full flex bg-gray-800/80">
                            <p className="flex-grow border-l-4 border-[#93C5FD] pl-3 ml-0 italic text-white">
                                {quoteMessage.message}
                            </p>

                            <Button
                                type="button"
                                onClick={() => setQuoted(null)}
                                className="bg-transparent text-white"
                            >
                                x
                            </Button>
                        </div>
                    )}

                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => handleEnterSend(e)}
                        placeholder="Type your message"
                        className="min-h-20 border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
                    />
                </div>

                <Button
                    size="icon-lg"
                    className="rounded-2xl bg-blue-500 text-white hover:bg-blue-400"
                    onClick={sendMessage}
                >
                    <Send className="size-4" />
                </Button>
            </div>
        </div>
    );
};

export default CollaborationChat;
