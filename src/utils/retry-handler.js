/**
 * Retry handler for database operations with exponential backoff
 * Handles race conditions and version conflicts in concurrent operations
 */

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 100)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 2000)
 * @param {Function} options.shouldRetry - Function to determine if error should trigger retry
 * @returns {Promise} Result of the operation
 */
export const retryOperation = async (operation, options = {}) => {
    const {
        maxRetries = 3,
        initialDelay = 100,
        maxDelay = 2000,
        shouldRetry = (error) => {
            // Retry on version conflicts (optimistic locking failures)
            if (error.name === 'VersionError') return true;
            
            // Retry on MongoDB duplicate key errors (race conditions)
            if (error.code === 11000) return true;
            
            // Retry on write conflicts
            if (error.code === 112) return true;
            
            // Retry on transaction aborted errors
            if (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) return true;
            
            return false;
        }
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Don't retry if this is the last attempt or error shouldn't be retried
            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Wait before retrying with exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Exponential backoff with jitter
            delay = Math.min(delay * 2 + Math.random() * 100, maxDelay);
        }
    }

    throw lastError;
};

/**
 * Retry a database update operation with optimistic locking
 * Automatically refetches the document on version conflicts
 * @param {Function} findDocument - Function that returns the document to update
 * @param {Function} updateDocument - Function that updates the document (receives fresh document)
 * @param {Object} options - Retry options
 * @returns {Promise} Updated document
 */
export const retryWithOptimisticLocking = async (findDocument, updateDocument, options = {}) => {
    return retryOperation(async () => {
        // Fetch fresh document
        const doc = await findDocument();
        
        if (!doc) {
            throw new Error('Document not found');
        }

        // Apply updates
        await updateDocument(doc);

        // Save with version check
        return await doc.save();
    }, options);
};
