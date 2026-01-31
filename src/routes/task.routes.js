import { Router } from "express";
import {
    createTask,
    getProjectTasks,
    getTaskById,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    uploadTaskAttachments,
    deleteTaskAttachment
} from "../controllers/task.controller.js";
import { 
    verifyJWT, 
    verifyProjectMembership, 
    verifyProjectRole 
} from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middleware.js";

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

// File attachment routes
router.route("/:projectId/t/:taskId/attachments")
    .post(
        verifyJWT,
        verifyProjectMembership,
        verifyProjectRole(['admin', 'project_admin']),
        upload.array('files', 10), // Allow up to 10 files
        uploadTaskAttachments
    );

router.route("/:projectId/t/:taskId/attachments/:attachmentId")
    .delete(
        verifyJWT,
        verifyProjectMembership,
        verifyProjectRole(['admin', 'project_admin']),
        deleteTaskAttachment
    );

export default router;
