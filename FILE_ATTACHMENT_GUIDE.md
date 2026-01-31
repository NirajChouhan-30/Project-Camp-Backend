# Task File Attachment Feature

## Overview
The file attachment feature allows users to upload and manage multiple files on tasks. This is useful for attaching documents, images, spreadsheets, and other relevant files to project tasks.

## API Endpoints

### 1. Upload Attachments to Task
**Endpoint:** `POST /api/v1/tasks/:projectId/t/:taskId/attachments`

**Authorization:** Admin or Project Admin only

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `files` (can upload up to 10 files at once)

**Supported File Types:**
- Images: JPEG, JPG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
- Archives: ZIP

**File Size Limit:** 10MB per file

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "attachments": [
      {
        "url": "/images/files-1234567890-123456789.pdf",
        "localPath": "public/images/files-1234567890-123456789.pdf",
        "mimetype": "application/pdf",
        "size": 245678,
        "_id": "65f1234567890abcdef12345"
      }
    ]
  },
  "message": "Files uploaded successfully",
  "success": true
}
```

### 2. Delete Attachment from Task
**Endpoint:** `DELETE /api/v1/tasks/:projectId/t/:taskId/attachments/:attachmentId`

**Authorization:** Admin or Project Admin only

**Response:**
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Attachment deleted successfully",
  "success": true
}
```

### 3. View Task Attachments
Attachments are included in the task details when you fetch a task:

**Endpoint:** `GET /api/v1/tasks/:projectId/t/:taskId`

**Response includes:**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "65f1234567890abcdef12345",
    "title": "Design Homepage",
    "description": "Create mockups for the homepage",
    "attachments": [
      {
        "url": "/images/files-1234567890-123456789.pdf",
        "localPath": "public/images/files-1234567890-123456789.pdf",
        "mimetype": "application/pdf",
        "size": 245678,
        "_id": "65f1234567890abcdef12346"
      }
    ],
    ...
  },
  "message": "Task retrieved successfully",
  "success": true
}
```

## Usage Examples

### Using cURL

**Upload files:**
```bash
curl -X POST \
  http://localhost:8000/api/v1/tasks/PROJECT_ID/t/TASK_ID/attachments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "files=@/path/to/document.pdf" \
  -F "files=@/path/to/image.png"
```

**Delete attachment:**
```bash
curl -X DELETE \
  http://localhost:8000/api/v1/tasks/PROJECT_ID/t/TASK_ID/attachments/ATTACHMENT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Using JavaScript (Fetch API)

**Upload files:**
```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('files', fileInput.files[1]);

const response = await fetch(
  `http://localhost:8000/api/v1/tasks/${projectId}/t/${taskId}/attachments`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  }
);

const result = await response.json();
```

**Delete attachment:**
```javascript
const response = await fetch(
  `http://localhost:8000/api/v1/tasks/${projectId}/t/${taskId}/attachments/${attachmentId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

## File Storage

- Files are stored in the `public/images` directory
- Files are accessible via the URL path (e.g., `/images/filename.pdf`)
- Each file is given a unique name with timestamp and random number to prevent conflicts
- Original file extension is preserved

## Security Features

1. **File Type Validation:** Only allowed file types can be uploaded
2. **File Size Limit:** Maximum 10MB per file
3. **Authorization:** Only Admin and Project Admin can upload/delete attachments
4. **Project Membership:** Users must be members of the project to access task attachments
5. **Automatic Cleanup:** Files are deleted from filesystem when:
   - Individual attachment is deleted
   - Parent task is deleted

## Error Handling

**Common Error Responses:**

- `400 Bad Request` - Invalid file type or no files uploaded
- `403 Forbidden` - User doesn't have permission (not Admin/Project Admin)
- `404 Not Found` - Task or attachment not found
- `413 Payload Too Large` - File exceeds 10MB limit

## Notes

- When a task is deleted, all associated attachment files are automatically removed from the filesystem
- Attachments are stored as an array in the task document
- Each attachment has a unique MongoDB ObjectId that can be used for deletion
- The `url` field provides the public path to access the file
- The `localPath` field stores the server filesystem path
