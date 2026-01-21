import { Router } from "express";
import {
    createNote,
    getProjectNotes,
    getNoteById,
    updateNote,
    deleteNote
} from "../controllers/note.controller.js";
import { 
    verifyJWT, 
    verifyRoles,
    verifyProjectMembership 
} from "../middlewares/auth.middlewares.js";

const router = Router();

// Note management routes
router.route("/:projectId")
    .post(verifyJWT, verifyRoles(['admin']), createNote)
    .get(verifyJWT, verifyProjectMembership, getProjectNotes);

router.route("/:projectId/n/:noteId")
    .get(verifyJWT, verifyProjectMembership, getNoteById)
    .put(verifyJWT, verifyRoles(['admin']), updateNote)
    .delete(verifyJWT, verifyRoles(['admin']), deleteNote);

export default router;
