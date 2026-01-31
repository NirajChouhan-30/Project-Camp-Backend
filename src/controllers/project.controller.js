import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectMember.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { Note } from "../models/note.models.js";
import mongoose from "mongoose";
import { retryWithOptimisticLocking, retryOperation } from "../utils/retry-handler.js";

/**
 * Create a new project (Admin only)
 * POST /api/v1/projects
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export const createProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    // Comprehensive input validation for name
    if (!name) {
        throw new ApiError(400, "Project name is required");
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new ApiError(400, "Project name cannot be empty or contain only whitespace");
    }

    // Validate description if provided
    const trimmedDescription = description ? description.trim() : "";

    // Use retry logic to handle transient transaction errors (Requirement 11.4)
    const project = await retryOperation(async () => {
        // Start a session for atomic transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Create the project within transaction
            const [newProject] = await Project.create([{
                name: trimmedName,
                description: trimmedDescription,
                owner: req.user._id
            }], { session });

            // Automatically add creator as member with admin role within transaction
            await ProjectMember.create([{
                project: newProject._id,
                user: req.user._id,
                role: 'admin',
                addedBy: req.user._id
            }], { session });

            // Commit the transaction
            await session.commitTransaction();

            return newProject;
        } catch (error) {
            // Rollback transaction on error
            await session.abortTransaction();
            throw error;
        } finally {
            // End the session
            session.endSession();
        }
    }, {
        maxRetries: 3,
        initialDelay: 100
    });

    res.status(201).json(
        new ApiResponse(201, project, "Project created successfully")
    );
});

/**
 * Get all projects for the authenticated user
 * GET /api/v1/projects
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export const getUserProjects = asyncHandler(async (req, res) => {
    // Find all project memberships for the user with proper population
    const memberships = await ProjectMember.find({ user: req.user._id })
        .populate('project', 'name description owner createdAt updatedAt')
        .lean();

    // Handle case where user has no project memberships
    if (!memberships || memberships.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, [], "Projects retrieved successfully")
        );
    }

    // Extract project IDs for member count aggregation
    const projectIds = memberships.map(m => m.project._id);

    // Aggregate member count for each project
    const memberCounts = await ProjectMember.aggregate([
        {
            $match: {
                project: { $in: projectIds }
            }
        },
        {
            $group: {
                _id: '$project',
                memberCount: { $sum: 1 }
            }
        }
    ]);

    // Create a map for quick lookup of member counts
    const memberCountMap = {};
    memberCounts.forEach(item => {
        memberCountMap[item._id.toString()] = item.memberCount;
    });

    // Build enriched project list with user's role and member count
    const projects = memberships.map(membership => ({
        _id: membership.project._id,
        name: membership.project.name,
        description: membership.project.description,
        owner: membership.project.owner,
        createdAt: membership.project.createdAt,
        updatedAt: membership.project.updatedAt,
        role: membership.role,
        memberCount: memberCountMap[membership.project._id.toString()] || 0,
        joinedAt: membership.joinedAt
    }));

    res.status(200).json(
        new ApiResponse(200, projects, "Projects retrieved successfully")
    );
});

/**
 * Get a specific project by ID
 * GET /api/v1/projects/:projectId
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export const getProjectById = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Authorization check is handled by verifyProjectMembership middleware (Requirement 3.2)
    // Non-existent projects are handled by middleware (Requirement 3.3)

    // Fetch project with owner information (Requirement 3.3 - project metadata)
    const project = await Project.findById(projectId)
        .populate('owner', 'username email fullName')
        .lean();

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Fetch complete member list with user details (Requirement 3.1, 3.4)
    const members = await ProjectMember.find({ project: projectId })
        .populate('user', 'username email fullName avatar')
        .populate('addedBy', 'username email')
        .sort({ joinedAt: 1 })
        .lean();

    // Build complete project response with all metadata and member list
    const projectData = {
        _id: project._id,
        name: project.name,
        description: project.description,
        owner: project.owner,
        createdAt: project.createdAt, // Project metadata (Requirement 3.3)
        updatedAt: project.updatedAt, // Project metadata (Requirement 3.3)
        userRole: req.projectMembership.role, // Current user's role in the project
        members: members, // Complete member list (Requirement 3.4)
        memberCount: members.length
    };

    res.status(200).json(
        new ApiResponse(200, projectData, "Project retrieved successfully")
    );
});

/**
 * Update a project (Project Admin only)
 * PUT /api/v1/projects/:projectId
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const updateProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { name, description } = req.body;

    // Authorization check is handled by verifyProjectMembership and verifyProjectRole middleware
    // This ensures the user is a member with admin role (Requirements 4.2, 4.4)

    // Use retry logic with optimistic locking to handle concurrent updates (Requirement 11.4)
    const updatedProject = await retryWithOptimisticLocking(
        // Fetch fresh document
        async () => {
            const project = await Project.findById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found");
            }
            return project;
        },
        // Apply updates
        async (project) => {
            // Ensure partial update support - only update provided fields (Requirement 4.1)
            if (name !== undefined) {
                // Comprehensive input validation for name (Requirement 4.3)
                const trimmedName = name.trim();
                if (!trimmedName) {
                    throw new ApiError(400, "Project name cannot be empty or contain only whitespace");
                }
                project.name = trimmedName;
            }

            if (description !== undefined) {
                project.description = description.trim();
            }

            // Save will preserve creation timestamp and update metadata automatically (Requirement 4.5)
            // Mongoose automatically updates the updatedAt field while preserving createdAt
            // The save operation is handled by retryWithOptimisticLocking
        },
        {
            maxRetries: 3,
            initialDelay: 100
        }
    );

    res.status(200).json(
        new ApiResponse(200, updatedProject, "Project updated successfully")
    );
});

/**
 * Delete a project with cascade deletion (Admin only)
 * DELETE /api/v1/projects/:projectId
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Authorization check is handled by verifyProjectMembership and verifyProjectRole middleware
    // This ensures the user is a member with admin role (Requirements 5.2, 5.5)

    // Verify project exists (Requirement 5.3)
    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Use retry logic to handle transient transaction errors (Requirement 11.4)
    await retryOperation(async () => {
        // Start a session for atomic transaction (Requirement 5.4)
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get all tasks for this project
            const tasks = await Task.find({ project: projectId }).session(session);
            const taskIds = tasks.map(task => task._id);

            // Cascade deletion in proper order (Requirement 5.1, 5.4):
            // 1. Delete all subtasks associated with tasks in this project
            await Subtask.deleteMany({ task: { $in: taskIds } }).session(session);

            // 2. Delete all tasks in this project
            await Task.deleteMany({ project: projectId }).session(session);

            // 3. Delete all notes in this project
            await Note.deleteMany({ project: projectId }).session(session);

            // 4. Delete all project memberships
            await ProjectMember.deleteMany({ project: projectId }).session(session);

            // 5. Delete the project itself
            await Project.findByIdAndDelete(projectId).session(session);

            // Commit the transaction (Requirement 5.4)
            await session.commitTransaction();
        } catch (error) {
            // Rollback transaction on error (Requirement 5.4)
            await session.abortTransaction();
            throw error;
        } finally {
            // End the session
            session.endSession();
        }
    }, {
        maxRetries: 3,
        initialDelay: 100
    });

    res.status(200).json(
        new ApiResponse(200, null, "Project deleted successfully")
    );
});

/**
 * Add a member to a project (Admin only)
 * POST /api/v1/projects/:projectId/members
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const addProjectMember = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { email, role } = req.body;

    // Validate required fields (Requirement 6.1)
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    if (!role) {
        throw new ApiError(400, "Role is required");
    }

    // Validate role value (Requirement 6.5)
    const validRoles = ['admin', 'project_admin', 'member'];
    if (!validRoles.includes(role)) {
        throw new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Add project existence validation (Requirement 6.1)
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Add user existence validation by email (Requirement 6.1, 6.3)
    const { User } = await import("../models/user.models.js");
    const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
    if (!userToAdd) {
        throw new ApiError(404, "User with this email does not exist");
    }

    // Prevent duplicate membership (Requirement 6.2)
    const existingMembership = await ProjectMember.findOne({
        project: projectId,
        user: userToAdd._id
    });

    if (existingMembership) {
        throw new ApiError(409, "User is already a member of this project");
    }

    // Create project membership with specified role (Requirement 6.1)
    const membership = await ProjectMember.create({
        project: projectId,
        user: userToAdd._id,
        role: role,
        addedBy: req.user._id
    });

    // Populate user details for response
    await membership.populate('user', 'username email fullName');
    await membership.populate('addedBy', 'username email');

    res.status(201).json(
        new ApiResponse(201, membership, "Member added successfully")
    );
});

/**
 * Get all members of a project (Member-only access)
 * GET /api/v1/projects/:projectId/members
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export const getProjectMembers = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Authorization check is handled by verifyProjectMembership middleware (Requirement 7.3)
    // This ensures only project members can view the member list

    // Find all memberships for this project with proper population of user details (Requirement 7.1, 7.3)
    const memberships = await ProjectMember.find({ project: projectId })
        .populate('user', 'username email fullName avatar') // Complete user details (Requirement 7.1)
        .populate('addedBy', 'username email fullName')
        .sort({ joinedAt: 1 }) // Sort by joinedAt ascending (Requirement 7.2)
        .lean();

    // Handle empty member lists appropriately (Requirement 7.4)
    // Return empty array without error if no members found
    if (!memberships || memberships.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, [], "Project members retrieved successfully")
        );
    }

    res.status(200).json(
        new ApiResponse(200, memberships, "Project members retrieved successfully")
    );
});

/**
 * Update a member's role in a project (Admin only)
 * PUT /api/v1/projects/:projectId/members/:userId
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export const updateProjectMemberRole = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    // Authorization check is handled by verifyProjectMembership and verifyProjectRole middleware
    // This ensures the user is a member with admin role (Requirements 8.2, 8.5)
    // verifyProjectMembership ensures admin is a member of the project (Requirement 8.5)
    // verifyProjectRole(['admin']) ensures only admins can update roles (Requirement 8.2)

    // Validate required fields
    if (!role) {
        throw new ApiError(400, "Role is required");
    }

    // Validate role value (Requirement 8.4)
    const validRoles = ['admin', 'project_admin', 'member'];
    if (!validRoles.includes(role)) {
        throw new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Use retry logic with optimistic locking to handle concurrent updates (Requirement 11.4)
    const updatedMembership = await retryWithOptimisticLocking(
        // Fetch fresh document
        async () => {
            const membership = await ProjectMember.findOne({
                project: projectId,
                user: userId
            });

            // Handle non-existent members appropriately (Requirement 8.3)
            if (!membership) {
                throw new ApiError(404, "Member not found in this project");
            }

            return membership;
        },
        // Apply updates
        async (membership) => {
            // Update only the role field, preserving other fields (Requirement 8.1)
            // Using .save() ensures only the role field is modified while preserving:
            // - joinedAt timestamp
            // - addedBy reference
            // - project reference
            // - user reference
            membership.role = role;
            // The save operation is handled by retryWithOptimisticLocking
        },
        {
            maxRetries: 3,
            initialDelay: 100
        }
    );

    // Populate user details for response (Requirement 8.1)
    await updatedMembership.populate('user', 'username email fullName');
    await updatedMembership.populate('addedBy', 'username email');

    res.status(200).json(
        new ApiResponse(200, updatedMembership, "Member role updated successfully")
    );
});

/**
 * Remove a member from a project (Admin only)
 * DELETE /api/v1/projects/:projectId/members/:userId
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export const removeProjectMember = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;

    // Authorization check is handled by verifyProjectMembership and verifyProjectRole middleware
    // This ensures the user is a member with admin role (Requirements 9.2, 9.5)
    // verifyProjectMembership ensures admin is a member of the project (Requirement 9.5)
    // verifyProjectRole(['admin']) ensures only admins can remove members (Requirement 9.2)

    // Find the membership (Requirement 9.3)
    const membership = await ProjectMember.findOne({
        project: projectId,
        user: userId
    });

    // Handle non-existent members appropriately (Requirement 9.3)
    if (!membership) {
        throw new ApiError(404, "Member not found in this project");
    }

    // Delete the membership (Requirement 9.1)
    // Note: Historical data (tasks, notes) created by this member is preserved (Requirement 9.4)
    // Only the membership record is deleted, not the user's contributions
    await ProjectMember.findByIdAndDelete(membership._id);

    res.status(200).json(
        new ApiResponse(200, null, "Member removed successfully")
    );
});
