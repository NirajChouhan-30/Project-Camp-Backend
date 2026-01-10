import express from "express";
import cors from "cors";

const app = express();

// Basic Configurations
app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));

// Cors Configirations
app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"]
    })
);

// Import the Routes

import healthCheckRouter from "./routes/healthcheck.routes.js"
import authRouter from "./routes/auth.routes.js";



app.use("/api/v1/healthcheck",healthCheckRouter);
app.use("/api/v1/auth",authRouter);

app.get("/", (req, res) => {
    res.send("Welcome to the Main Page")
});

app.get("/about", (req, res) => {
    res.send("This is About page");
});

export default app;