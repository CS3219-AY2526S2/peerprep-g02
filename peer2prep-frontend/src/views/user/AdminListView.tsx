import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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

type SummaryCardProps = {
    title: string;
    value: number;
    description: string;
    icon: ComponentType<{ className?: string }>;
    tone?: "default" | "warning";
};

type StateCardProps = {
    title: string;
    description: string;
    action?: ReactNode;
};

type DirectoryTableProps = {
    users: AdminUser[];
    updatingUserIds: Set<string>;
    onToggleRole: (user: AdminUser) => Promise<void>;
    onToggleStatus: (user: AdminUser) => Promise<void>;
};

function SummaryCard({
    title,
    value,
    description,
    icon: Icon,
    tone = "default",
}: SummaryCardProps) {
    return (
        <Card className="border bg-card/95">
            <CardHeader className="border-b">
                <CardDescription>{title}</CardDescription>
                <CardAction>
                    <div
                        className={cn(
                            "rounded-full p-2",
                            tone === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-primary/10 text-primary",
                        )}
                    >
                        <Icon className="size-4" />
                    </div>
                </CardAction>
                <CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}

function RoleBadge({ role }: { role: UserRole }) {
    if (role === "super_user") {
        return <Badge variant="outline">Super user</Badge>;
    }

    if (role === "admin") {
        return <Badge>Admin</Badge>;
    }

    return <Badge variant="secondary">User</Badge>;
}

function StatusBadge({ status }: { status: UserStatus }) {
    if (status === "active") {
        return <Badge variant="success">Active</Badge>;
    }

    if (status === "suspended") {
        return <Badge variant="warning">Suspended</Badge>;
    }

    return <Badge variant="destructive">Deleted</Badge>;
}

function StateCard({ title, description, action }: StateCardProps) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
            <p className="text-base font-medium text-foreground">{title}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

function DirectoryTable({
    users,
    updatingUserIds,
    onToggleRole,
    onToggleStatus,
}: DirectoryTableProps) {
    return (
        <div className="overflow-hidden rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[24%]">Name</TableHead>
                        <TableHead className="w-[30%]">Email</TableHead>
                        <TableHead className="w-[14%]">Role</TableHead>
                        <TableHead className="w-[14%]">Status</TableHead>
                        <TableHead className="w-[22%] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => {
                        const isUpdating = updatingUserIds.has(user.clerkUserId);

                        return (
                            <TableRow key={user.clerkUserId}>
                                <TableCell>
                                    <p className="font-medium text-foreground">{user.name}</p>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {user.email}
                                </TableCell>
                                <TableCell>
                                    <RoleBadge role={user.role} />
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={user.status} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-nowrap justify-end gap-2">
                                        {user.role === "super_user" ? (
                                            <Badge variant="outline" className="rounded-md">
                                                Protected
                                            </Badge>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-full px-4"
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
                                                    className="rounded-full px-4"
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
    const { userId } = useAuth();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingUserIds, setUpdatingUserIds] = useState<string[]>([]);

    const loadUsers = async () => {
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
        void loadUsers();
    }, [userId]);

    const filteredUsers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) return users;

        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(normalizedSearch) ||
                user.email.toLowerCase().includes(normalizedSearch),
        );
    }, [search, users]);

    const updatingUserIdSet = useMemo(() => new Set(updatingUserIds), [updatingUserIds]);

    const stats = useMemo(
        () => ({
            totalUsers: users.length,
            adminUsers: users.filter((user) => user.role !== "user").length,
            suspendedUsers: users.filter((user) => user.status === "suspended").length,
        }),
        [users],
    );

    const patchRole = async (targetUser: AdminUser, role: "user" | "admin") => {
        setUpdatingUserIds((previous) =>
            previous.includes(targetUser.clerkUserId)
                ? previous
                : [...previous, targetUser.clerkUserId],
        );

        try {
            const response = await apiFetch(
                API_ENDPOINTS.USERS.UPDATE_ROLE(targetUser.clerkUserId),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role }),
                },
            );
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                pushToast({
                    tone: "error",
                    message: payload?.error || "Failed to update role.",
                });
                return;
            }

            const updatedUser = payload?.data?.user;
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.clerkUserId === targetUser.clerkUserId
                        ? { ...user, role: updatedUser?.role || user.role }
                        : user,
                ),
            );
            pushToast({ tone: "success", message: `Updated ${targetUser.name} to ${role}.` });
        } catch {
            pushToast({ tone: "error", message: "Network error updating role." });
        } finally {
            setUpdatingUserIds((previous) =>
                previous.filter((id) => id !== targetUser.clerkUserId),
            );
        }
    };

    const patchStatus = async (targetUser: AdminUser, status: "active" | "suspended") => {
        setUpdatingUserIds((previous) =>
            previous.includes(targetUser.clerkUserId)
                ? previous
                : [...previous, targetUser.clerkUserId],
        );

        try {
            const response = await apiFetch(
                API_ENDPOINTS.USERS.UPDATE_STATUS(targetUser.clerkUserId),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                },
            );
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                pushToast({
                    tone: "error",
                    message: payload?.error || "Failed to update status.",
                });
                return;
            }

            const updatedUser = payload?.data?.user;
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.clerkUserId === targetUser.clerkUserId
                        ? { ...user, status: updatedUser?.status || user.status }
                        : user,
                ),
            );
            pushToast({ tone: "success", message: `Updated ${targetUser.name} to ${status}.` });
        } catch {
            pushToast({ tone: "error", message: "Network error updating status." });
        } finally {
            setUpdatingUserIds((previous) =>
                previous.filter((id) => id !== targetUser.clerkUserId),
            );
        }
    };

    const isEmpty = !loading && !error && filteredUsers.length === 0;

    return (
        <section className="min-h-screen bg-muted/30">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            User administration
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Search users, review account roles, and manage account status from one
                            place.
                        </p>
                    </div>

                    <Button asChild variant="outline" size="lg">
                        <Link to={ROUTES.PROFILE}>
                            <ArrowLeft className="size-4" />
                            Back to profile
                        </Link>
                    </Button>
                </header>

                <div className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        title="Managed users"
                        value={stats.totalUsers}
                        description="All user accounts visible to this admin, excluding your own."
                        icon={Users}
                    />
                    <SummaryCard
                        title="Admins and super users"
                        value={stats.adminUsers}
                        description="Accounts with elevated permissions across the platform."
                        icon={ShieldCheck}
                    />
                    <SummaryCard
                        title="Suspended accounts"
                        value={stats.suspendedUsers}
                        description="Users currently restricted from normal account access."
                        icon={ShieldAlert}
                        tone="warning"
                    />
                </div>

                <Card className="border bg-card/95">
                    <CardHeader className="gap-4 border-b pb-5">
                        <div className="space-y-1">
                            <CardTitle>Directory</CardTitle>
                            <CardDescription>
                                {filteredUsers.length} result
                                {filteredUsers.length === 1 ? "" : "s"}
                                {search.trim() ? ` for "${search.trim()}"` : ""}.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative w-full md:min-w-80">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search by name or email"
                                    className="pl-9"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadUsers()}
                                disabled={loading}
                            >
                                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {loading ? (
                            <div className="grid gap-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-16 animate-pulse rounded-xl bg-muted"
                                    />
                                ))}
                            </div>
                        ) : null}

                        {!loading && error ? (
                            <StateCard
                                title="Unable to load users"
                                description={error}
                                action={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void loadUsers()}
                                    >
                                        Try again
                                    </Button>
                                }
                            />
                        ) : null}

                        {isEmpty ? (
                            <StateCard
                                title="No users found"
                                description={
                                    search.trim()
                                        ? "Try a different name or email search."
                                        : "User accounts will appear here once they are available."
                                }
                            />
                        ) : null}

                        {!loading && !error && !isEmpty ? (
                            <DirectoryTable
                                users={filteredUsers}
                                updatingUserIds={updatingUserIdSet}
                                onToggleRole={(user) =>
                                    patchRole(user, user.role === "admin" ? "user" : "admin")
                                }
                                onToggleStatus={(user) =>
                                    patchStatus(
                                        user,
                                        user.status === "active" ? "suspended" : "active",
                                    )
                                }
                            />
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
