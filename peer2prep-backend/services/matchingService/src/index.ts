import app from "@/app.js";

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Matching Service live at http://localhost:${PORT}`);
});
