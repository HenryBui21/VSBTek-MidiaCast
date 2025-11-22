# 📺 VSBTek MediaCast

> Hệ thống quản lý và trình chiếu media chuyên nghiệp cho TV/màn hình hiển thị

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| 📤 **Upload Media** | Tải lên và quản lý hình ảnh, video dễ dàng |
| 📂 **Phân loại thông minh** | Tổ chức media theo danh mục tùy chỉnh |
| 🔄 **Slideshow tự động** | Trình chiếu liên tục với cấu hình loop video |
| 🔐 **Xác thực đa cấp** | Phân quyền Admin/User rõ ràng |
| 🔗 **Chia sẻ nhanh** | Tạo link slideshow cho TV chỉ với 1 click |

---

## 🚀 Hướng dẫn triển khai

### 🐳 Cách 1: Docker (Khuyến nghị cho NAS/Server)

**Bước 1:** Clone repository
```bash
git clone https://github.com/HenryBui21/VSBTek-MidiaCast.git
cd VSBTek-MidiaCast
```

**Bước 2:** Khởi chạy container
```bash
docker compose up -d
```

**Bước 3:** Kiểm tra logs (tùy chọn)
```bash
docker compose logs -f
```

<details>
<summary>📌 <b>Các lệnh Docker hữu ích khác</b></summary>

```bash
# Dừng container
docker compose down

# Cập nhật khi có phiên bản mới
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

</details>

<details>
<summary>📌 <b>Hướng dẫn cho Synology NAS</b></summary>

1. Mở **Container Manager**
2. Vào **Project** → **Add**
3. Import từ thư mục chứa `docker-compose.yml`
4. Nhấn **Build & Run**

</details>

---

### 💻 Cách 2: Node.js (Chạy trực tiếp)

> **Yêu cầu:** Node.js phiên bản 18 trở lên

**Bước 1:** Clone repository
```bash
git clone https://github.com/HenryBui21/VSBTek-MidiaCast.git
cd VSBTek-MidiaCast
```

**Bước 2:** Khởi chạy server
```bash
node server.js
```

<details>
<summary>📌 <b>Chạy như System Service (Linux)</b></summary>

**Tạo file service:**
```bash
sudo nano /etc/systemd/system/mediacast.service
```

**Nội dung file:**
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

**Kích hoạt service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable mediacast
sudo systemctl start mediacast
```

</details>

<details>
<summary>📌 <b>Chạy với PM2 (Khuyến nghị cho Production)</b></summary>

```bash
# Cài đặt PM2
npm install -g pm2

# Khởi chạy ứng dụng
pm2 start server.js --name mediacast

# Lưu cấu hình và tự động khởi động
pm2 save
pm2 startup
```

</details>

---

## 📖 Hướng dẫn sử dụng

| Bước | Hành động |
|:----:|-----------|
| 1️⃣ | Truy cập `http://localhost:3000` (hoặc `http://<IP>:3000`) |
| 2️⃣ | Lần đầu tiên: Nhập username/password để tạo tài khoản **Admin** |
| 3️⃣ | Upload media và tổ chức theo danh mục |
| 4️⃣ | Chia sẻ link slideshow cho TV: `http://<IP>:3000/slideshow.html` |

---

## 📁 Cấu trúc thư mục

```
VSBTek-MidiaCast/
│
├── 🖥️  server.js           # Backend Node.js (port 3000)
├── 📄  index.html           # Trang quản lý media
├── 🎬  slideshow.html       # Trang trình chiếu (dành cho TV)
│
├── 🐳  docker-compose.yml   # Cấu hình Docker Compose
├── 🐳  Dockerfile           # Build image Docker
│
├── 📂  uploads/             # Thư mục lưu media (tự động tạo)
└── 💾  data.json            # Dữ liệu ứng dụng (tự động tạo)
```

---

## 📜 License

Dự án được phát hành theo giấy phép **MIT** - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<div align="center">

**Made with ❤️ by [VSBTek](https://github.com/HenryBui21)**

</div>
