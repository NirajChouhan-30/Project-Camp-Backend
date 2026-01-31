import { Router } from "express";
import {
    createProject,
    getUserProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addProjectMember,
    getProjectMembers,
    updateProjectMemberRole,
    removeProjectMember
} from "../controllers/project.controller.js";
import { verifyJWT, verifyRoles, verifyProjectMembership, verifyProjectRole } from "../middlewares/auth.middlewares.js";

const router = Router();

// Admin-only routes
router.route("/")
    .post(verifyJWT, verifyRoles(['admin']), createProject)
    .get(verifyJWT, getUserProjects);

router.route("/:projectId")
    .get(verifyJWT, verifyProjectMembership, getProjectById)
    .put(verifyJWT, verifyProjectMembership, verifyProjectRole(['admin']), updateProject)
    .delete(verifyJWT, verifyProjectMembership, verifyProjectRole(['admin']), deleteProject);

// Project member management routes
router.route("/:projectId/members")
    .post(verifyJWT, verifyRoles(['admin']), addProjectMember)
    .get(verifyJWT, verifyProjectMembership, getProjectMembers);

router.route("/:projectId/members/:userId")
    .put(verifyJWT, verifyProjectMembership, verifyProjectRole(['admin']), updateProjectMemberRole)
    .delete(verifyJWT, verifyProjectMembership, verifyProjectRole(['admin']), removeProjectMember);

export default router;
