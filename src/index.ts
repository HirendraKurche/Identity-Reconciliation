import express from "express";
import identifyRouter from "./routes/identify";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies.
app.use(express.json());

// Health-check endpoint.
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Identity Reconciliation Service" });
});

// Mount the /identify route.
app.use("/identify", identifyRouter);

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export default app;
