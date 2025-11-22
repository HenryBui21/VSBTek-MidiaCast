// VSBTek MediaCast Backend Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'data.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initialize data file if not exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        media: [],
        categories: ['Chung', 'Sản phẩm', 'Sự kiện', 'Khuyến mãi'],
        settings: {
            slideDuration: 3000,
            transitionEffect: 'fade',
            transitionSpeed: 600
        },
        users: []
    }, null, 2));
}

// Load data
function loadData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {
            media: [],
            categories: ['Chung', 'Sản phẩm', 'Sự kiện', 'Khuyến mãi'],
            settings: {},
            users: []
        };
    }
}

// Save data
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ico': 'image/x-icon'
};

// Parse multipart form data
function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);

    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;

    while (start < buffer.length) {
        const end = buffer.indexOf(boundaryBuffer, start);
        if (end === -1) break;

        const part = buffer.slice(start, end - 2);
        const headerEnd = part.indexOf('\r\n\r\n');

        if (headerEnd !== -1) {
            const headerStr = part.slice(0, headerEnd).toString();
            const content = part.slice(headerEnd + 4);

            const nameMatch = headerStr.match(/name="([^"]+)"/);
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);
            const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

            parts.push({
                name: nameMatch ? nameMatch[1] : '',
                filename: filenameMatch ? filenameMatch[1] : null,
                contentType: contentTypeMatch ? contentTypeMatch[1] : null,
                data: content
            });
        }

        start = end + boundaryBuffer.length + 2;
    }

    return parts;
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        handleAPI(req, res, pathname, parsedUrl.query);
        return;
    }

    // Serve uploaded files
    if (pathname.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, pathname);
        serveFile(res, filePath);
        return;
    }

    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    serveFile(res, filePath);
});

// Serve static file
function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Handle API requests
function handleAPI(req, res, pathname, query) {
    const data = loadData();

    // GET /api/media - Get all media
    if (pathname === '/api/media' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.media));
        return;
    }

    // POST /api/media - Upload media
    if (pathname === '/api/media' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        const boundary = contentType.split('boundary=')[1];

        if (!boundary) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid content type' }));
            return;
        }

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const parts = parseMultipart(buffer, boundary);

                let category = 'Chung';
                let file = null;

                for (const part of parts) {
                    if (part.name === 'category') {
                        category = part.data.toString();
                    } else if (part.name === 'file' && part.filename) {
                        file = part;
                    }
                }

                if (!file) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No file uploaded' }));
                    return;
                }

                // Save file
                const id = generateId();
                const ext = path.extname(file.filename);
                const savedFilename = id + ext;
                const savedPath = path.join(UPLOADS_DIR, savedFilename);

                fs.writeFileSync(savedPath, file.data);

                // Determine type
                const type = file.contentType.startsWith('video') ? 'video' : 'image';

                // Add to data
                const mediaItem = {
                    id: id,
                    name: file.filename,
                    type: type,
                    category: category,
                    mimeType: file.contentType,
                    filename: savedFilename,
                    url: '/uploads/' + savedFilename,
                    uploadedAt: new Date().toISOString(),
                    loopCount: 1
                };

                data.media.push(mediaItem);
                saveData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(mediaItem));

            } catch (error) {
                console.error('Upload error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Upload failed' }));
            }
        });
        return;
    }

    // PUT /api/media/:id - Update media
    if (pathname.match(/^\/api\/media\/[^/]+$/) && req.method === 'PUT') {
        const id = pathname.split('/').pop();

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const index = data.media.findIndex(m => m.id === id);

                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Media not found' }));
                    return;
                }

                data.media[index] = { ...data.media[index], ...updates };
                saveData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data.media[index]));

            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // DELETE /api/media/:id - Delete media
    if (pathname.match(/^\/api\/media\/[^/]+$/) && req.method === 'DELETE') {
        const id = pathname.split('/').pop();
        const index = data.media.findIndex(m => m.id === id);

        if (index === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Media not found' }));
            return;
        }

        // Delete file
        const media = data.media[index];
        const filePath = path.join(UPLOADS_DIR, media.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        data.media.splice(index, 1);
        saveData(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // DELETE /api/media - Clear all media
    if (pathname === '/api/media' && req.method === 'DELETE') {
        // Delete all files
        for (const media of data.media) {
            const filePath = path.join(UPLOADS_DIR, media.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        data.media = [];
        saveData(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // GET /api/categories - Get categories
    if (pathname === '/api/categories' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.categories));
        return;
    }

    // POST /api/categories - Add category
    if (pathname === '/api/categories' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { name } = JSON.parse(body);
                if (!data.categories.includes(name)) {
                    data.categories.push(name);
                    saveData(data);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data.categories));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // DELETE /api/categories/:name - Delete category
    if (pathname.match(/^\/api\/categories\//) && req.method === 'DELETE') {
        const name = decodeURIComponent(pathname.split('/').pop());

        if (name === 'Chung') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Cannot delete default category' }));
            return;
        }

        // Move media to default category
        data.media.forEach(m => {
            if (m.category === name) {
                m.category = 'Chung';
            }
        });

        data.categories = data.categories.filter(c => c !== name);
        saveData(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.categories));
        return;
    }

    // GET /api/settings - Get settings
    if (pathname === '/api/settings' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.settings));
        return;
    }

    // PUT /api/settings - Update settings
    if (pathname === '/api/settings' && req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                data.settings = { ...data.settings, ...updates };
                saveData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data.settings));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // Users API
    // GET /api/users
    if (pathname === '/api/users' && req.method === 'GET') {
        // Return users without password hashes
        const safeUsers = data.users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
            createdAt: u.createdAt
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(safeUsers));
        return;
    }

    // GET /api/users/count
    if (pathname === '/api/users/count' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: data.users.length }));
        return;
    }

    // POST /api/users - Add user
    if (pathname === '/api/users' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const user = JSON.parse(body);
                user.id = generateId();
                user.createdAt = new Date().toISOString();

                // Check if username exists
                if (data.users.find(u => u.username === user.username)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Username exists' }));
                    return;
                }

                data.users.push(user);
                saveData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id: user.id, username: user.username, role: user.role }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // POST /api/auth/login - Login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { username, passwordHash } = JSON.parse(body);

                // If no users exist, create admin user
                if (data.users.length === 0) {
                    const newUser = {
                        id: generateId(),
                        username: username,
                        passwordHash: passwordHash,
                        role: 'admin',
                        createdAt: new Date().toISOString()
                    };
                    data.users.push(newUser);
                    saveData(data);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        isNewUser: true,
                        user: { id: newUser.id, username: newUser.username, role: newUser.role }
                    }));
                    return;
                }

                // Find user by username first
                const userByName = data.users.find(u => u.username === username);
                if (!userByName) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Tên đăng nhập không tồn tại!' }));
                    return;
                }

                // Check password
                if (userByName.passwordHash === passwordHash) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        user: { id: userByName.id, username: userByName.username, role: userByName.role }
                    }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Mật khẩu không đúng!' }));
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // PUT /api/users/:id - Update user
    if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'PUT') {
        const id = pathname.split('/').pop();

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const index = data.users.findIndex(u => u.id === id);

                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User not found' }));
                    return;
                }

                data.users[index] = { ...data.users[index], ...updates };
                saveData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));

            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
            }
        });
        return;
    }

    // DELETE /api/users/:id - Delete user
    if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'DELETE') {
        const id = pathname.split('/').pop();
        const index = data.users.findIndex(u => u.id === id);

        if (index === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'User not found' }));
            return;
        }

        data.users.splice(index, 1);
        saveData(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 404 for unknown API routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          VSBTek MediaCast Server                           ║
╠════════════════════════════════════════════════════════════╣
║  Server đang chạy tại:                                     ║
║  - Local:   http://localhost:${PORT}                          ║
║  - Network: http://<IP-máy-tính>:${PORT}                      ║
║                                                            ║
║  Trên TV, mở trình duyệt và truy cập:                      ║
║  http://<IP-máy-tính>:${PORT}/slideshow.html                  ║
╚════════════════════════════════════════════════════════════╝
    `);
});
