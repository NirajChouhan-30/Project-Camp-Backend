import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Basic Configurations
app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser())



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
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";


app.use("/api/v1/healthcheck",healthCheckRouter);
app.use("/api/v1/auth",authRouter);
app.use("/api/v1/projects",projectRouter);
app.use("/api/v1/tasks",taskRouter);
app.use("/api/v1/notes",noteRouter);

app.get("/", (req, res) => {
    res.send("Welcome to the Main Page")
});

app.get("/about", (req, res) => {
    res.send("This is About page");
});

// Global error handler middleware
// This must be defined after all routes
app.use((err, req, res, next) => {
    // Default to 500 if no status code is set
    const statusCode = err.statusCode || 500;
    
    // Prepare error response
    const errorResponse = {
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || []
    };

    // Don't leak sensitive information in production
    if (process.env.NODE_ENV !== 'production' && err.stack) {
        errorResponse.stack = err.stack;
    }

    // Ensure we don't leak sensitive authorization details
    // Remove any internal role mappings or membership data from the response
    if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
        errorResponse.errors = errorResponse.errors.map(error => {
            // If error is an object, sanitize it
            if (typeof error === 'object' && error !== null) {
                const { role, membership, user, ...sanitizedError } = error;
                return sanitizedError;
            }
            return error;
        });
    }

    // Log server errors (5xx) for debugging
    if (statusCode >= 500) {
        console.error('Server Error:', {
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
});

export default app;