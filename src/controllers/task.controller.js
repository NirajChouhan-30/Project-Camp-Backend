import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { User } from "../models/user.models.js";

/**
 * Create a new task (Admin or Project Admin only)
 * POST /api/v1/tasks/:projectId
 */
export const createTask = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, description, assignee } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
        throw new ApiError(400, "Task title is required");
    }

    // Validate assignee if provided
    if (assignee) {
        const assigneeUser = await User.findById(assignee);
        if (!assigneeUser) {
            throw new ApiError(404, "Assignee user not found");
        }
    }

    // Create the task
    const task = await Task.create({
        project: projectId,
        title: title.trim(),
        description: description?.trim() || "",
        assignee: assignee || null,
        status: 'todo',
        createdBy: req.user._id
    });

    // Populate references for response
    await task.populate('assignee', 'username email');
    await task.populate('createdBy', 'username email');

    res.status(201).json(
        new ApiResponse(201, task, "Task created successfully")
    );
});

/**
 * Get all tasks for a project
 * GET /api/v1/tasks/:projectId
 */
export const getProjectTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Find all tasks for this project
    const tasks = await Task.find({ project: projectId })
        .populate('assignee', 'username email')
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 });

    res.status(200).json(
        new ApiResponse(200, tasks, "Tasks retrieved successfully")
    );
});

/**
 * Get a specific task by ID
 * GET /api/v1/tasks/:projectId/t/:taskId
 */
export const getTaskById = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, project: projectId })
        .populate('assignee', 'username email')
        .populate('createdBy', 'username email');

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    res.status(200).json(
        new ApiResponse(200, task, "Task retrieved successfully")
    );
});

/**
 * Update a task (Admin or Project Admin only)
 * PUT /api/v1/tasks/:projectId/t/:taskId
 */
export const updateTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title, description, assignee, status } = req.body;

    const task = await Task.findOne({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    // Validate assignee if provided
    if (assignee !== undefined && assignee !== null) {
        const assigneeUser = await User.findById(assignee);
        if (!assigneeUser) {
            throw new ApiError(404, "Assignee user not found");
        }
    }

    // Validate status if provided
    if (status !== undefined) {
        const validStatuses = ['todo', 'in_progress', 'done'];
        if (!validStatuses.includes(status)) {
            throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
    }

    // Update fields if provided
    if (title !== undefined) {
        if (!title.trim()) {
            throw new ApiError(400, "Task title cannot be empty");
        }
        task.title = title.trim();
    }

    if (description !== undefined) {
        task.description = description.trim();
    }

    if (assignee !== undefined) {
        task.assignee = assignee;
    }

    if (status !== undefined) {
        task.status = status;
    }

    await task.save();

    // Populate references for response
    await task.populate('assignee', 'username email');
    await task.populate('createdBy', 'username email');

    res.status(200).json(
        new ApiResponse(200, task, "Task updated successfully")
    );
});

/**
 * Delete a task with cascade deletion of subtasks (Admin or Project Admin only)
 * DELETE /api/v1/tasks/:projectId/t/:taskId
 */
export const deleteTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    // Cascade deletion: Delete all subtasks associated with this task
    await Subtask.deleteMany({ task: taskId });

    // Delete the task itself
    await Task.findByIdAndDelete(taskId);

    res.status(200).json(
        new ApiResponse(200, null, "Task deleted successfully")
    );
});

/**
 * Create a new subtask (Admin or Project Admin only)
 * POST /api/v1/tasks/:projectId/t/:taskId/subtasks
 */
export const createSubtask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title, description } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
        throw new ApiError(400, "Subtask title is required");
    }

    // Verify task exists and belongs to the project
    const task = await Task.findOne({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    // Create the subtask
    const subtask = await Subtask.create({
        task: taskId,
        title: title.trim(),
        description: description?.trim() || "",
        isCompleted: false,
        createdBy: req.user._id
    });

    // Populate references for response
    await subtask.populate('createdBy', 'username email');

    res.status(201).json(
        new ApiResponse(201, subtask, "Subtask created successfully")
    );
});

/**
 * Update a subtask with conditional logic based on role
 * PUT /api/v1/tasks/:projectId/st/:subtaskId
 * - Members can only update isCompleted field
 * - Project Admins can update all fields
 */
export const updateSubtask = asyncHandler(async (req, res) => {
    const { projectId, subtaskId } = req.params;
    const { title, description, isCompleted } = req.body;

    // Find the subtask and populate task to verify project
    const subtask = await Subtask.findById(subtaskId).populate('task');

    if (!subtask) {
        throw new ApiError(404, "Subtask not found");
    }

    // Verify the subtask's task belongs to the project
    if (subtask.task.project.toString() !== projectId) {
        throw new ApiError(404, "Subtask not found in this project");
    }

    // Get user's project role from middleware
    const userRole = req.projectMembership.role;

    // Members can only update isCompleted field
    if (userRole === 'member') {
        if (title !== undefined || description !== undefined) {
            throw new ApiError(
                403, 
                "Members can only update the completion status of subtasks"
            );
        }

        if (isCompleted !== undefined) {
            subtask.isCompleted = isCompleted;
        }
    } 
    // Project Admins and Admins can update all fields
    else if (userRole === 'admin' || userRole === 'project_admin') {
        if (title !== undefined) {
            if (!title.trim()) {
                throw new ApiError(400, "Subtask title cannot be empty");
            }
            subtask.title = title.trim();
        }

        if (description !== undefined) {
            subtask.description = description.trim();
        }

        if (isCompleted !== undefined) {
            subtask.isCompleted = isCompleted;
        }
    }

    await subtask.save();

    // Populate references for response
    await subtask.populate('createdBy', 'username email');

    res.status(200).json(
        new ApiResponse(200, subtask, "Subtask updated successfully")
    );
});

/**
 * Delete a subtask (Admin or Project Admin only)
 * DELETE /api/v1/tasks/:projectId/st/:subtaskId
 */
export const deleteSubtask = asyncHandler(async (req, res) => {
    const { projectId, subtaskId } = req.params;

    // Find the subtask and populate task to verify project
    const subtask = await Subtask.findById(subtaskId).populate('task');

    if (!subtask) {
        throw new ApiError(404, "Subtask not found");
    }

    // Verify the subtask's task belongs to the project
    if (subtask.task.project.toString() !== projectId) {
        throw new ApiError(404, "Subtask not found in this project");
    }

    // Delete the subtask
    await Subtask.findByIdAndDelete(subtaskId);

    res.status(200).json(
        new ApiResponse(200, null, "Subtask deleted successfully")
    );
});
