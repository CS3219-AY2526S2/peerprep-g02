import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";
import { ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";

type AdminUser = {
    clerkUserId: string;
    name: string;
    email: string;
    role: "user" | "admin" | "super_user";
    status: "active" | "suspended" | "deleted";
};

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
        if (!normalized) return users;

        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(normalized) ||
                user.email.toLowerCase().includes(normalized),
        );
    }, [search, users]);

    const patchRole = async (targetUser: AdminUser, role: "user" | "admin") => {
        setUpdatingUserIds((prev) => [...prev, targetUser.clerkUserId]);
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
                    message: payload?.error || `Failed to update role`,
                });
                return;
            }

            const updatedUser = payload?.data?.user;
            setUsers((current) =>
                current.map((u) =>
                    u.clerkUserId === targetUser.clerkUserId
                        ? { ...u, role: updatedUser?.role || u.role }
                        : u,
                ),
            );
            pushToast({ tone: "success", message: `Updated ${targetUser.name} to ${role}` });
        } catch (err) {
            pushToast({ tone: "error", message: "Network error updating role" });
        } finally {
            setUpdatingUserIds((prev) => prev.filter((id) => id !== targetUser.clerkUserId));
        }
    };

    const patchStatus = async (targetUser: AdminUser, status: "active" | "suspended") => {
        setUpdatingUserIds((prev) => [...prev, targetUser.clerkUserId]);
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
                pushToast({ tone: "error", message: payload?.error || `Failed to update status` });
                return;
            }

            const updatedUser = payload?.data?.user;
            setUsers((current) =>
                current.map((u) =>
                    u.clerkUserId === targetUser.clerkUserId
                        ? { ...u, status: updatedUser?.status || u.status }
                        : u,
                ),
            );
            pushToast({ tone: "success", message: `Updated ${targetUser.name} to ${status}` });
        } catch (err) {
            pushToast({ tone: "error", message: "Network error updating status" });
        } finally {
            setUpdatingUserIds((prev) => prev.filter((id) => id !== targetUser.clerkUserId));
        }
    };

    const actionButtonClass =
        "min-w-[5.8rem] rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

    return (
        <section className="mx-auto max-w-[1100px] px-6 py-12 text-left">
            <h1 className="m-0 text-3xl font-semibold text-gray-900">User Admin</h1>

            <div className="mb-4 mt-3">
                <Link
                    to={ROUTES.PROFILE}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
                >
                    Back to profile
                </Link>
            </div>

            <input
                className="mb-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            {loading && <p className="text-sm text-gray-600">Loading users...</p>}
            {!loading && error && <p className="text-sm text-red-700">{error}</p>}

            {!loading && !error && (
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
                            <tr className="bg-gray-50">
                                <th className="border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700">
                                    Name
                                </th>
                                <th className="border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700">
                                    Email
                                </th>
                                <th className="border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700">
                                    Role
                                </th>
                                <th className="border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700">
                                    Status
                                </th>
                                <th className="border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700">
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
                                                ) : (
                                                    <>
                                                        <button
                                                            className={actionButtonClass}
                                                            disabled={isUpdating}
                                                            onClick={() =>
                                                                void patchRole(
                                                                    user,
                                                                    user.role === "admin"
                                                                        ? "user"
                                                                        : "admin",
                                                                )
                                                            }
                                                        >
                                                            {user.role === "admin"
                                                                ? "Demote"
                                                                : "Promote"}
                                                        </button>
                                                        <button
                                                            className={actionButtonClass}
                                                            disabled={isUpdating}
                                                            onClick={() =>
                                                                void patchStatus(
                                                                    user,
                                                                    user.status === "active"
                                                                        ? "suspended"
                                                                        : "active",
                                                                )
                                                            }
                                                        >
                                                            {user.status === "active"
                                                                ? "Suspend"
                                                                : "Unsuspend"}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
