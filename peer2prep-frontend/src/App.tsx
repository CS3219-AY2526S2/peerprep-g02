import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/authRoute/ProtectedRoute";
import { ROUTES } from "@/constants/routes";

import LoginView from "@/views/user/LoginView";
import RegisterView from "@/views/user/RegisterView";
import ProfileView from "@/views/user/ProfileView";
import AdminListView from "@/views/user/AdminListView";
import HomeView from "@/views/HomeView";
import QuestionMainView from "@/views/question/QuestionMainView";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path={ROUTES.DASHBOARD} element={<HomeView />} />
                <Route path={`${ROUTES.LOGIN}/*`} element={<LoginView />} />
                <Route path={`${ROUTES.REGISTER}/*`} element={<RegisterView />} />

                <Route element={<ProtectedRoute />}>
                    <Route path={ROUTES.PROFILE} element={<ProfileView />} />
                </Route>

                <Route
                    element={<ProtectedRoute allowedRoles={["admin", "super_user"]} />}
                >
                    <Route path={ROUTES.USER_ADMIN} element={<AdminListView />} />
                    <Route path={ROUTES.QUESTION_ADMIN} element={<QuestionMainView />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
