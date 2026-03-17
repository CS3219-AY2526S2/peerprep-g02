import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiFetch } from "@/lib/apiClient";
import { pushToast } from "@/lib/toast";

type AdminUser = {
    clerkUserId: string;
    name: string;
    email: string;
    role: "user" | "admin" | "super_user";
    status: "active" | "suspended" | "deleted";
};

export default function AdminPage() {
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
            const response = await apiFetch("/users/admin/users", { method: "GET" });
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

            // get all users except current user
            const normalizedUsers = (fetchedUsers as AdminUser[]).filter(
                (user) => user.clerkUserId !== userId,
            );
            setUsers(normalizedUsers);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        if (!normalized) {
            return users;
        }

        return users.filter((user) => {
            return (
                user.name.toLowerCase().includes(normalized) ||
                user.email.toLowerCase().includes(normalized)
            );
        });
    }, [search, users]);

    const patchRole = async (targetUser: AdminUser, role: "user" | "admin") => {
        setUpdatingUserIds((current) =>
            current.includes(targetUser.clerkUserId)
                ? current
                : [...current, targetUser.clerkUserId],
        );
        try {
            const response = await apiFetch(`/users/admin/users/${targetUser.clerkUserId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                pushToast({
                    tone: "error",
                    message: payload?.error || `Failed to update role (status ${response.status})`,
                });
                return;
            }

            const updatedUser = payload?.data?.user as Partial<AdminUser> | undefined;
            setUsers((current) =>
                current.map((user) =>
                    user.clerkUserId === targetUser.clerkUserId
                        ? { ...user, role: (updatedUser?.role as AdminUser["role"]) || user.role }
                        : user,
                ),
            );
            pushToast({
                tone: "success",
                message: `Successfully updated ${targetUser.name}'s role to ${role}`,
            });
        } catch (error) {
            pushToast({
                tone: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to update role due to a network error",
            });
        } finally {
            setUpdatingUserIds((current) => current.filter((id) => id !== targetUser.clerkUserId));
        }
    };

    const patchStatus = async (targetUser: AdminUser, status: "active" | "suspended") => {
        setUpdatingUserIds((current) =>
            current.includes(targetUser.clerkUserId)
                ? current
                : [...current, targetUser.clerkUserId],
        );
        try {
            const response = await apiFetch(`/users/admin/users/${targetUser.clerkUserId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                pushToast({
                    tone: "error",
                    message:
                        payload?.error || `Failed to update status (status ${response.status})`,
                });
                return;
            }

            const updatedUser = payload?.data?.user as Partial<AdminUser> | undefined;
            setUsers((current) =>
                current.map((user) =>
                    user.clerkUserId === targetUser.clerkUserId
                        ? {
                              ...user,
                              status: (updatedUser?.status as AdminUser["status"]) || user.status,
                          }
                        : user,
                ),
            );
            pushToast({
                tone: "success",
                message: `Successfully updated ${targetUser.name}'s status to ${status}`,
            });
        } catch (error) {
            pushToast({
                tone: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to update status due to a network error",
            });
        } finally {
            setUpdatingUserIds((current) => current.filter((id) => id !== targetUser.clerkUserId));
        }
    };

    const actionButtonClass =
        "min-w-[5.8rem] rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

    return (
        <section className="mx-auto max-w-[1100px] px-6 py-12 text-left">
            <h1 className="m-0 text-3xl font-semibold text-gray-900">User Admin</h1>
            <div className="mb-4 mt-3 flex items-center gap-4">
                <a
                    href="/account/profile"
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                    Back to profile
                </a>
            </div>

            <input
                className="mb-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
            />

            {loading ? <p className="text-sm text-gray-600">Loading users...</p> : null}
            {!loading && error ? <p className="text-sm text-red-700">{error}</p> : null}

            {!loading && !error ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
                        <colgroup>
                            <col className="w-[20%]" />
                            <col className="w-[30%]" />
                            <col className="w-[12%]" />
                            <col className="w-[14%]" />
                            <col className="w-[24%]" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                                >
                                    Name
                                </th>
                                <th
                                    scope="col"
                                    className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                                >
                                    Email
                                </th>
                                <th
                                    scope="col"
                                    className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                                >
                                    Role
                                </th>
                                <th
                                    scope="col"
                                    className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                                >
                                    Status
                                </th>
                                <th
                                    scope="col"
                                    className="border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                                >
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, index) => {
                                const isUpdating = updatingUserIds.includes(user.clerkUserId);
                                return (
                                    <tr
                                        key={user.clerkUserId}
                                        className={index % 2 === 1 ? "bg-gray-50/40" : "bg-white"}
                                    >
                                        <td className="truncate border-b border-gray-200 px-3 py-3 align-middle text-gray-900">
                                            {user.name}
                                        </td>
                                        <td className="truncate border-b border-gray-200 px-3 py-3 align-middle text-gray-900">
                                            {user.email}
                                        </td>
                                        <td className="truncate border-b border-gray-200 px-3 py-3 align-middle capitalize text-gray-800">
                                            {user.role}
                                        </td>
                                        <td className="truncate border-b border-gray-200 px-3 py-3 align-middle capitalize text-gray-800">
                                            {user.status}
                                        </td>
                                        <td className="border-b border-gray-200 px-3 py-3 align-middle">
                                            <div className="flex flex-wrap gap-2">
                                                {user.role === "super_user" ? (
                                                    <span className="inline-flex min-w-[5.8rem] items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                                        Protected
                                                    </span>
                                                ) : user.role === "user" ? (
                                                    <button
                                                        className={actionButtonClass}
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() =>
                                                            void patchRole(user, "admin")
                                                        }
                                                    >
                                                        Promote
                                                    </button>
                                                ) : (
                                                    <button
                                                        className={actionButtonClass}
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() => void patchRole(user, "user")}
                                                    >
                                                        Demote
                                                    </button>
                                                )}

                                                {user.role === "super_user" ? null : user.status ===
                                                  "active" ? (
                                                    <button
                                                        className={actionButtonClass}
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() =>
                                                            void patchStatus(user, "suspended")
                                                        }
                                                    >
                                                        Suspend
                                                    </button>
                                                ) : (
                                                    <button
                                                        className={actionButtonClass}
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() =>
                                                            void patchStatus(user, "active")
                                                        }
                                                    >
                                                        Unsuspend
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
