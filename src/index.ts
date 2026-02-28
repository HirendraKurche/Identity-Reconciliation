import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import identifyRouter from "./routes/identify";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins.
app.use(cors());

// Parse incoming JSON request bodies.
app.use(express.json());

// Serve Swagger API documentation at /api-docs.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve static files (landing page) from the /public directory.
app.use(express.static(path.join(__dirname, "../public")));

// Mount the /identify route.
app.use("/identify", identifyRouter);

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export default app;
