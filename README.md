# VSBTek MediaCast

Hệ thống quản lý và trình chiếu media cho TV/màn hình hiển thị.

## Tính năng

- Upload và quản lý hình ảnh/video
- Phân loại media theo danh mục
- Slideshow tự động với cấu hình loop video
- Xác thực đa người dùng (Admin/User)
- Chia sẻ link slideshow cho TV

## Deploy

### Docker (khuyến nghị cho NAS/Server)

```bash
# Clone repo
git clone https://github.com/HenryBui21/VSBTek-MidiaCast.git
cd VSBTek-MidiaCast

# Chạy container
docker compose up -d

# Xem logs
docker compose logs -f

# Dừng container
docker compose down

# Rebuild khi có update
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Synology NAS:**
1. Mở Container Manager
2. Project > Add > Import từ thư mục chứa `docker-compose.yml`
3. Build & Run

### Node.js (chạy trực tiếp)

**Yêu cầu:** Node.js 18+

```bash
# Clone repo
git clone https://github.com/HenryBui21/VSBTek-MidiaCast.git
cd VSBTek-MidiaCast

# Chạy server
node server.js
```

**Chạy như service (Linux):**

```bash
# Tạo systemd service
sudo nano /etc/systemd/system/mediacast.service
```

```ini
[Unit]
Description=VSBTek MediaCast
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/VSBTek-MidiaCast
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Kích hoạt service
sudo systemctl daemon-reload
sudo systemctl enable mediacast
sudo systemctl start mediacast
```

**PM2 (khuyến nghị cho production):**

```bash
npm install -g pm2
pm2 start server.js --name mediacast
pm2 save
pm2 startup
```

## Sử dụng

1. Truy cập `http://localhost:3000` (hoặc `http://<IP>:3000`)
2. Lần đầu: nhập username/password để tạo tài khoản admin
3. Upload media và tổ chức theo danh mục
4. Chia sẻ link slideshow cho TV: `http://<IP>:3000/slideshow.html`

## Cấu trúc

```text
├── server.js        # Backend Node.js (port 3000)
├── index.html       # Trang quản lý
├── slideshow.html   # Trang trình chiếu (cho TV)
├── docker-compose.yml
├── Dockerfile
├── uploads/         # Thư mục media (tự tạo)
└── data.json        # Dữ liệu ứng dụng (tự tạo)
```

## License

MIT
