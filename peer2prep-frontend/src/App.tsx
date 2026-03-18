import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ROUTES } from "@/constants/routes";

import Login from "@/services/user/Login";
import Register from "@/services/user/Register";
import ProfileView from "@/views/user/ProfileView";
import AdminListView from "@/views/user/AdminListView";
import QuestionAdmin from "@/components/admin/QuestionAdmin";
import HomeView from "@/views/HomeView";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path={ROUTES.DASHBOARD} element={<HomeView />} />
                <Route path={ROUTES.LOGIN} element={<Login />} />
                <Route path={ROUTES.REGISTER} element={<Register />} />

                <Route element={<ProtectedRoute />}>
                    <Route path={ROUTES.PROFILE} element={<ProfileView />} />
                </Route>

                <Route element={<ProtectedRoute adminOnly />}>
                    <Route path={ROUTES.USER_ADMIN} element={<AdminListView />} />
                    <Route path={ROUTES.QUESTION_ADMIN} element={<QuestionAdmin />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
