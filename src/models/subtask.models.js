import mongoose, { Schema } from "mongoose";

const subtaskSchema = new Schema(
    {
        task: {
            type: Schema.Types.ObjectId,
            ref: "Task",
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        isCompleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const Subtask = mongoose.model("Subtask", subtaskSchema);
