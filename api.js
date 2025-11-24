// API Client for VSBTek MediaCast
// Connects to backend server for shared media storage

class MediaCastAPI {
    constructor() {
        // Auto-detect API base URL
        this.baseURL = window.location.origin;
        this.isAvailable = null; // null = not checked, true/false = checked
    }

    // Check if API server is available
    async checkAvailability() {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/media`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            this.isAvailable = response.ok;
        } catch (e) {
            this.isAvailable = false;
        }

        return this.isAvailable;
    }

    // Media API
    async getAllMedia() {
        const response = await fetch(`${this.baseURL}/api/media`);
        if (!response.ok) throw new Error('Failed to fetch media');
        return response.json();
    }

    async uploadMedia(file, category) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const response = await fetch(`${this.baseURL}/api/media`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload media');
        return response.json();
    }

    async updateMedia(id, updates) {
        const response = await fetch(`${this.baseURL}/api/media/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update media');
        return response.json();
    }

    async deleteMedia(id) {
        const response = await fetch(`${this.baseURL}/api/media/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete media');
        return response.json();
    }

    async clearAllMedia() {
        const response = await fetch(`${this.baseURL}/api/media`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to clear media');
        return response.json();
    }

    // Categories API
    async getCategories() {
        const response = await fetch(`${this.baseURL}/api/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        return response.json();
    }

    async addCategory(name) {
        const response = await fetch(`${this.baseURL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) throw new Error('Failed to add category');
        return response.json();
    }

    async deleteCategory(name) {
        const response = await fetch(`${this.baseURL}/api/categories/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete category');
        return response.json();
    }

    // Settings API
    async getSettings() {
        const response = await fetch(`${this.baseURL}/api/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
    }

    async updateSettings(settings) {
        const response = await fetch(`${this.baseURL}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to update settings');
        return response.json();
    }

    // Users API
    async getUsersCount() {
        const response = await fetch(`${this.baseURL}/api/users/count`);
        if (!response.ok) throw new Error('Failed to fetch users count');
        const data = await response.json();
        return data.count;
    }

    async getAdminInitialized() {
        const response = await fetch(`${this.baseURL}/api/admin-initialized`);
        if (!response.ok) throw new Error('Failed to fetch admin initialized status');
        const data = await response.json();
        return data.initialized;
    }

    async getAllUsers() {
        const response = await fetch(`${this.baseURL}/api/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    }

    async addUser(user) {
        const response = await fetch(`${this.baseURL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add user');
        }
        return response.json();
    }

    async updateUser(id, updates) {
        const response = await fetch(`${this.baseURL}/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update user');
        return response.json();
    }

    async deleteUser(id) {
        const response = await fetch(`${this.baseURL}/api/users/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete user');
        return response.json();
    }

    async getUserById(id) {
        const users = await this.getAllUsers();
        return users.find(u => u.id === id) || null;
    }

    async login(username, passwordHash) {
        const response = await fetch(`${this.baseURL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, passwordHash })
        });

        const data = await response.json();
        return data;
    }

    // Utility: Get full URL for media file
    getMediaURL(media) {
        return `${this.baseURL}${media.url}`;
    }
}

// Export singleton instance
const api = new MediaCastAPI();
