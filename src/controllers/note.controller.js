import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { Note } from "../models/note.models.js";
import { Project } from "../models/project.models.js";

/**
 * Create a new note (Admin only)
 * POST /api/v1/notes/:projectId
 */
export const createNote = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, content } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
        throw new ApiError(400, "Note title is required");
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Create the note
    const note = await Note.create({
        project: projectId,
        title: title.trim(),
        content: content?.trim() || "",
        createdBy: req.user._id
    });

    // Populate references for response
    await note.populate('createdBy', 'username email');

    res.status(201).json(
        new ApiResponse(201, note, "Note created successfully")
    );
});

/**
 * Get all notes for a project
 * GET /api/v1/notes/:projectId
 */
export const getProjectNotes = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Find all notes for this project
    const notes = await Note.find({ project: projectId })
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 });

    res.status(200).json(
        new ApiResponse(200, notes, "Notes retrieved successfully")
    );
});

/**
 * Get a specific note by ID
 * GET /api/v1/notes/:projectId/n/:noteId
 */
export const getNoteById = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;

    const note = await Note.findOne({ _id: noteId, project: projectId })
        .populate('createdBy', 'username email');

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    res.status(200).json(
        new ApiResponse(200, note, "Note retrieved successfully")
    );
});

/**
 * Update a note (Admin only)
 * PUT /api/v1/notes/:projectId/n/:noteId
 */
export const updateNote = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;
    const { title, content } = req.body;

    const note = await Note.findOne({ _id: noteId, project: projectId });

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    // Update fields if provided
    if (title !== undefined) {
        if (!title.trim()) {
            throw new ApiError(400, "Note title cannot be empty");
        }
        note.title = title.trim();
    }

    if (content !== undefined) {
        note.content = content.trim();
    }

    await note.save();

    // Populate references for response
    await note.populate('createdBy', 'username email');

    res.status(200).json(
        new ApiResponse(200, note, "Note updated successfully")
    );
});

/**
 * Delete a note (Admin only)
 * DELETE /api/v1/notes/:projectId/n/:noteId
 */
export const deleteNote = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;

    const note = await Note.findOne({ _id: noteId, project: projectId });

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    // Delete the note
    await Note.findByIdAndDelete(noteId);

    res.status(200).json(
        new ApiResponse(200, null, "Note deleted successfully")
    );
});
