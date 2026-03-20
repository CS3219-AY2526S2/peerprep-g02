import { useAuth } from "@clerk/clerk-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/authRoute/ProtectedRoute";
import { ROUTES } from "@/constants/routes";

import LoginView from "@/views/user/LoginView";
import RegisterView from "@/views/user/RegisterView";
import AdminListView from "@/views/user/AdminListView";
import HomeView from "@/views/HomeView";
import QuestionMainView from "@/views/question/QuestionMainView";

const ADMIN_ALLOWED_ROLES: Array<"admin" | "super_user"> = ["admin", "super_user"];

function AdminProtectedRoute() {
    return <ProtectedRoute allowedRoles={ADMIN_ALLOWED_ROLES} />;
}

function RootRedirect() {
    const { isLoaded, isSignedIn } = useAuth();

    if (!isLoaded) {
        return null;
    }

    return <Navigate to={isSignedIn ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path={`${ROUTES.LOGIN}/*`} element={<LoginView />} />
                <Route path={`${ROUTES.REGISTER}/*`} element={<RegisterView />} />

                <Route element={<ProtectedRoute />}>
                    <Route path={ROUTES.DASHBOARD} element={<HomeView />} />
                </Route>

                <Route element={<AdminProtectedRoute />}>
                    <Route path={ROUTES.USER_ADMIN} element={<AdminListView />} />
                    <Route path={ROUTES.QUESTION_ADMIN} element={<QuestionMainView />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
