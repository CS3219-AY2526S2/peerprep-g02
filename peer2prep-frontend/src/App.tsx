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

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
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
