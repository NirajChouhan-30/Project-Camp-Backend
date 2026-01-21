import { Router } from "express";
import {
    createTask,
    getProjectTasks,
    getTaskById,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask
} from "../controllers/task.controller.js";
import { 
    verifyJWT, 
    verifyProjectMembership, 
    verifyProjectRole 
} from "../middlewares/auth.middlewares.js";

const router = Router();

// Task management routes
router.route("/:projectId")
    .post(
        verifyJWT, 
        verifyProjectMembership, 
        verifyProjectRole(['admin', 'project_admin']), 
        createTask
    )
    .get(verifyJWT, verifyProjectMembership, getProjectTasks);

router.route("/:projectId/t/:taskId")
    .get(verifyJWT, verifyProjectMembership, getTaskById)
    .put(
        verifyJWT, 
        verifyProjectMembership, 
        verifyProjectRole(['admin', 'project_admin']), 
        updateTask
    )
    .delete(
        verifyJWT, 
        verifyProjectMembership, 
        verifyProjectRole(['admin', 'project_admin']), 
        deleteTask
    );

// Subtask management routes
router.route("/:projectId/t/:taskId/subtasks")
    .post(
        verifyJWT,
        verifyProjectMembership,
        verifyProjectRole(['admin', 'project_admin']),
        createSubtask
    );

router.route("/:projectId/st/:subtaskId")
    .put(
        verifyJWT,
        verifyProjectMembership,
        updateSubtask
    )
    .delete(
        verifyJWT,
        verifyProjectMembership,
        verifyProjectRole(['admin', 'project_admin']),
        deleteSubtask
    );

export default router;
