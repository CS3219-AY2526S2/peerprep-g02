import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";

type UserRole = "user" | "admin" | "super_user";
type UserStatus = "active" | "suspended" | "deleted";

type AdminUser = {
    clerkUserId: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
};

type StatCardProps = {
    title: string;
    value: number;
    description: string;
    icon: ComponentType<{ className?: string }>;
    className?: string;
    iconClassName?: string;
    valueClassName?: string;
    descriptionClassName?: string;
    titleClassName?: string;
};

type StatePanelProps = {
    title: string;
    description: string;
    action?: ReactNode;
};

type UserDirectoryTableProps = {
    users: AdminUser[];
    updatingUsers: Set<string>;
    onToggleRole: (user: AdminUser) => Promise<void>;
    onToggleStatus: (user: AdminUser) => Promise<void>;
};

function StatCardSkeleton() {
    return (
        <Card className="rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardContent className="p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="size-14 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-12 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
            </CardContent>
        </Card>
    );
}

function StatCard({
    title,
    value,
    description,
    icon: Icon,
    className,
    iconClassName,
    valueClassName,
    descriptionClassName,
    titleClassName,
}: StatCardProps) {
    return (
        <Card
            className={cn(
                "rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                className,
            )}
        >
            <CardContent className="p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div
                        className={cn(
                            "flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700",
                            iconClassName,
                        )}
                    >
                        <Icon className="size-7" />
                    </div>
                    <p className={cn("text-sm font-medium text-black", titleClassName)}>{title}</p>
                </div>
                <p
                    className={cn(
                        "text-5xl font-bold tracking-tight text-slate-950",
                        valueClassName,
                    )}
                >
                    {value}
                </p>
                <p className={cn("mt-2 text-base text-slate-600", descriptionClassName)}>
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

function StatePanel({ title, description, action }: StatePanelProps) {
    return (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
            <p className="text-lg font-bold tracking-tight text-slate-950">{title}</p>
            <p className="mt-2 max-w-xl text-sm text-slate-600">{description}</p>
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}

function RoleBadge({ role }: { role: UserRole }) {
    if (role === "super_user") {
        return (
            <Badge
                variant="outline"
                className="inline-flex w-auto justify-center rounded-full border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[0.8rem] font-semibold text-white"
            >
                Super user
            </Badge>
        );
    }

    if (role === "admin") {
        return (
            <Badge className="inline-flex w-auto justify-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[0.8rem] font-semibold text-indigo-700 hover:bg-indigo-50">
                Admin
            </Badge>
        );
    }

    return (
        <Badge
            variant="secondary"
            className="inline-flex w-auto justify-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[0.8rem] font-semibold text-slate-700"
        >
            User
        </Badge>
    );
}

function StatusBadge({ status }: { status: UserStatus }) {
    if (status === "active") {
        return (
            <Badge
                variant="success"
                className="inline-flex w-auto justify-center rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
            >
                Active
            </Badge>
        );
    }

    if (status === "suspended") {
        return (
            <Badge
                variant="warning"
                className="inline-flex w-auto justify-center rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
            >
                Suspended
            </Badge>
        );
    }

    return (
        <Badge
            variant="destructive"
            className="inline-flex w-auto justify-center rounded-full border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
        >
            Deleted
        </Badge>
    );
}

function UserDirectoryTable({
    users,
    updatingUsers,
    onToggleRole,
    onToggleStatus,
}: UserDirectoryTableProps) {
    return (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <Table className="table-fixed">
                <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[20%] px-4 text-slate-950">
                            <div className="flex justify-left">Name</div>
                        </TableHead>
                        <TableHead className="w-[28%] px-4 text-slate-950">
                            <div className="flex justify-left">Email</div>
                        </TableHead>
                        <TableHead className="w-[15%] px-4 text-center text-slate-950">
                            Role
                        </TableHead>
                        <TableHead className="w-[15%] px-4 text-center text-slate-950">
                            Status
                        </TableHead>
                        <TableHead className="w-[22%] px-4 text-center text-slate-950">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => {
                        const isUpdating = updatingUsers.has(user.clerkUserId);

                        return (
                            <TableRow
                                key={user.clerkUserId}
                                className="border-slate-200 hover:bg-slate-50/70"
                            >
                                <TableCell className="px-4 py-4">
                                    <p className="truncate text-[0.9rem] font-semibold text-slate-950">
                                        {user.name}
                                    </p>
                                </TableCell>
                                <TableCell className="px-4 py-4">
                                    <p className="truncate text-[0.9rem] text-slate-600">
                                        {user.email}
                                    </p>
                                </TableCell>
                                <TableCell className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                        <RoleBadge role={user.role} />
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                        <StatusBadge status={user.status} />
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-4">
                                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                        {user.role === "super_user" ? (
                                            <Badge
                                                variant="outline"
                                                className="inline-flex w-auto justify-center rounded-full border-slate-300 px-2.5 py-0.5 text-[0.8rem] font-semibold text-slate-600"
                                            >
                                                Protected
                                            </Badge>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-full border-slate-300 px-3.5"
                                                    disabled={isUpdating}
                                                    onClick={() => void onToggleRole(user)}
                                                >
                                                    {user.role === "admin" ? "Demote" : "Promote"}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={
                                                        user.status === "active"
                                                            ? "destructive"
                                                            : "secondary"
                                                    }
                                                    size="sm"
                                                    className={cn(
                                                        "rounded-full px-3.5",
                                                        "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                                                    )}
                                                    disabled={isUpdating}
                                                    onClick={() => void onToggleStatus(user)}
                                                >
                                                    {user.status === "active"
                                                        ? "Suspend"
                                                        : "Unsuspend"}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

export default function AdminListView() {
    const { isLoaded: isAuthLoaded, userId } = useAuth();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingUserIds, setUpdatingUserIds] = useState<string[]>([]);

    const loadUsers = async () => {
        if (!isAuthLoaded) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await apiFetch(API_ENDPOINTS.USERS.ADMIN_LIST, { method: "GET" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 403) {
                    setError("Unauthorized: admin access required.");
                    return;
                }

                setError(payload?.error || `Failed to load users (status ${response.status}).`);
                return;
            }

            const fetchedUsers = payload?.data?.users;

            if (!Array.isArray(fetchedUsers)) {
                setUsers([]);
                return;
            }

            setUsers((fetchedUsers as AdminUser[]).filter((user) => user.clerkUserId !== userId));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthLoaded) {
            return;
        }

        void loadUsers();
    }, [isAuthLoaded, userId]);

    const filteredUsers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
            return users;
        }

        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(normalizedSearch) ||
                user.email.toLowerCase().includes(normalizedSearch),
        );
    }, [search, users]);

    const updatingUsers = useMemo(() => new Set(updatingUserIds), [updatingUserIds]);

    const stats = useMemo(
        () => ({
            totalUsers: users.length,
            elevatedUsers: users.filter((user) => user.role !== "user").length,
            suspendedUsers: users.filter((user) => user.status === "suspended").length,
        }),
        [users],
    );

    const updateTrackedUser = async (
        targetUser: AdminUser,
        action: () => Promise<Response>,
        successMessage: string,
        applyUpdate: (
            currentUser: AdminUser,
            payloadUser: Partial<AdminUser> | undefined,
        ) => AdminUser,
    ) => {
        setUpdatingUserIds((currentIds) =>
            currentIds.includes(targetUser.clerkUserId)
                ? currentIds
                : [...currentIds, targetUser.clerkUserId],
        );

        try {
            const response = await action();
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                pushToast({
                    tone: "error",
                    message: payload?.error || "Failed to update user.",
                });
                return;
            }

            const payloadUser = payload?.data?.user as Partial<AdminUser> | undefined;

            setUsers((currentUsers) =>
                currentUsers.map((currentUser) =>
                    currentUser.clerkUserId === targetUser.clerkUserId
                        ? applyUpdate(currentUser, payloadUser)
                        : currentUser,
                ),
            );
            pushToast({ tone: "success", message: successMessage });
        } catch {
            pushToast({
                tone: "error",
                message: "A network error occurred while updating the user.",
            });
        } finally {
            setUpdatingUserIds((currentIds) =>
                currentIds.filter((id) => id !== targetUser.clerkUserId),
            );
        }
    };

    const toggleRole = async (targetUser: AdminUser) => {
        const nextRole = targetUser.role === "admin" ? "user" : "admin";

        await updateTrackedUser(
            targetUser,
            () =>
                apiFetch(API_ENDPOINTS.USERS.UPDATE_ROLE(targetUser.clerkUserId), {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: nextRole }),
                }),
            `Updated ${targetUser.name} to ${nextRole}.`,
            (currentUser, payloadUser) => ({
                ...currentUser,
                role: (payloadUser?.role as UserRole | undefined) || currentUser.role,
            }),
        );
    };

    const toggleStatus = async (targetUser: AdminUser) => {
        const nextStatus = targetUser.status === "active" ? "suspended" : "active";

        await updateTrackedUser(
            targetUser,
            () =>
                apiFetch(API_ENDPOINTS.USERS.UPDATE_STATUS(targetUser.clerkUserId), {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: nextStatus }),
                }),
            `Updated ${targetUser.name} to ${nextStatus}.`,
            (currentUser, payloadUser) => ({
                ...currentUser,
                status: (payloadUser?.status as UserStatus | undefined) || currentUser.status,
            }),
        );
    };

    const isEmpty = !loading && !error && filteredUsers.length === 0;
    const isInitialLoad = (!isAuthLoaded && users.length === 0) || (loading && users.length === 0);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-semibold">&lt;/&gt;</span>
                        </div>
                        <div>
                            <p className="text-3xl font-extrabold tracking-tight text-slate-950">
                                PeerPrep
                            </p>
                            <p className="text-sm text-slate-500">Admin workspace</p>
                        </div>
                    </div>

                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="rounded-full border-slate-300 bg-white px-5"
                    >
                        <Link to={ROUTES.DASHBOARD}>
                            <ArrowLeft className="size-4" />
                            Back to dashboard
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
                <section className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                        User administration
                    </h1>
                    <p className="mt-3 max-w-3xl text-lg text-slate-600">
                        Review roles, manage account status, and find users quickly from the same
                        dashboard experience.
                    </p>
                </section>

                <section className="grid gap-6 md:grid-cols-3">
                    {isInitialLoad ? (
                        <>
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </>
                    ) : (
                        <>
                            <StatCard
                                title="Managed users"
                                value={stats.totalUsers}
                                description="Accounts currently visible to this admin view."
                                icon={Users}
                                className="bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-600 text-white"
                                iconClassName="bg-white/15 text-white"
                                valueClassName="text-white"
                                descriptionClassName="text-white/85"
                                titleClassName="text-white"
                            />
                            <StatCard
                                title="Admins and super users"
                                value={stats.elevatedUsers}
                                description="People with elevated permissions across the platform."
                                icon={ShieldCheck}
                                iconClassName="bg-violet-100 text-violet-600"
                            />
                            <StatCard
                                title="Suspended accounts"
                                value={stats.suspendedUsers}
                                description="Users currently restricted from normal account access."
                                icon={ShieldAlert}
                                iconClassName="bg-amber-100 text-amber-600"
                            />
                        </>
                    )}
                </section>

                <section className="mt-8">
                    <Card className="rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                        <CardHeader className="gap-5 border-b border-slate-200 px-6 py-6 sm:px-8">
                            <div className="space-y-1">
                                <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-950">
                                    User directory
                                </CardTitle>
                                <CardDescription className="text-base text-slate-600">
                                    {isInitialLoad
                                        ? "Preparing your user directory..."
                                        : loading
                                          ? "Loading users..."
                                          : `${filteredUsers.length} result${filteredUsers.length === 1 ? "" : "s"}${search.trim() ? ` for "${search.trim()}"` : ""}.`}
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:max-w-md">
                                    <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search by name or email"
                                        className="h-11 rounded-full border-slate-200 bg-white pl-14 pr-4 text-slate-900 shadow-sm"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void loadUsers()}
                                    disabled={loading}
                                    className="rounded-full border-slate-300 bg-white px-5"
                                >
                                    <RefreshCw
                                        className={cn("size-4", loading && "animate-spin")}
                                    />
                                    Refresh
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 sm:p-8">
                            {isInitialLoad ? (
                                <div className="grid gap-4">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="h-16 animate-pulse rounded-[20px] bg-slate-100"
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {!loading && error ? (
                                <StatePanel
                                    title="Unable to load users"
                                    description={error}
                                    action={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void loadUsers()}
                                            className="rounded-full border-slate-300 bg-white px-5"
                                        >
                                            Try again
                                        </Button>
                                    }
                                />
                            ) : null}

                            {isEmpty ? (
                                <StatePanel
                                    title="No users found"
                                    description={
                                        search.trim()
                                            ? "Try a different name or email search."
                                            : "User accounts will appear here once they are available."
                                    }
                                />
                            ) : null}

                            {!loading && !error && !isEmpty ? (
                                <UserDirectoryTable
                                    users={filteredUsers}
                                    updatingUsers={updatingUsers}
                                    onToggleRole={toggleRole}
                                    onToggleStatus={toggleStatus}
                                />
                            ) : null}
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
}
