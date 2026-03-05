import "./App.css";
import CollaborationPage from "./pages/CollaborationPage";
import UserView from "./components/user/UserView";

function App() {
    const pathname = window.location.pathname;

    if (pathname.startsWith("/collaboration")) {
        return <CollaborationPage />;
    }

    return (
        <main>
            <UserView />
        </main>
    );
}

export default App;
