// IndexedDB Manager for VSBTek MediaCast
class DatabaseManager {
    constructor() {
        this.dbName = 'MediaCastDB';
        this.version = 3; // Upgraded for users store
        this.db = null;
    }

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Lỗi khi mở database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database đã được khởi tạo thành công');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create media store
                if (!db.objectStoreNames.contains('media')) {
                    const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
                    mediaStore.createIndex('category', 'category', { unique: false });
                    mediaStore.createIndex('name', 'name', { unique: false });
                    mediaStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
                }

                // Add loop count field for existing media store (migration)
                if (db.objectStoreNames.contains('media') && event.oldVersion < 2) {
                    // Schema migration will be handled at runtime when loading media
                }

                // Create categories store
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                }

                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Create users store (version 3)
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    usersStore.createIndex('username', 'username', { unique: true });
                    usersStore.createIndex('role', 'role', { unique: false });
                }
            };
        });
    }

    // Media operations
    async addMedia(mediaItem) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.add(mediaItem);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllMedia() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['media'], 'readonly');
            const store = transaction.objectStore('media');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteMedia(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllMedia() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async updateMedia(mediaItem) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.put(mediaItem);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Category operations
    async saveCategories(categories) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['categories'], 'readwrite');
                const store = transaction.objectStore('categories');

                // Clear existing categories
                await new Promise((res, rej) => {
                    const clearRequest = store.clear();
                    clearRequest.onsuccess = () => res();
                    clearRequest.onerror = () => rej(clearRequest.error);
                });

                // Add new categories
                for (const category of categories) {
                    await new Promise((res, rej) => {
                        const addRequest = store.add({ name: category });
                        addRequest.onsuccess = () => res();
                        addRequest.onerror = () => rej(addRequest.error);
                    });
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async getCategories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');
            const request = store.getAll();

            request.onsuccess = () => {
                const categories = request.result.map(item => item.name);
                resolve(categories);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Settings operations
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Utility: Convert blob URL to blob for display
    createBlobURL(blob) {
        return URL.createObjectURL(blob);
    }

    // Utility: Revoke blob URL to free memory
    revokeBlobURL(url) {
        URL.revokeObjectURL(url);
    }

    // User operations
    async addUser(user) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.add(user);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateUser(user) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getUsersCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
