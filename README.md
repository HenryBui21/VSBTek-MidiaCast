# VSBTek MediaCast

Hệ thống quản lý và trình chiếu media cho TV/màn hình hiển thị.

## Tính năng

- Upload và quản lý hình ảnh/video
- Phân loại media theo danh mục
- Slideshow tự động với cấu hình loop video
- Xác thực đa người dùng (Admin/User)
- Chia sẻ link slideshow cho TV

## Cài đặt

### Chạy với Docker (khuyến nghị)

```bash
docker compose up -d
```

Truy cập: `http://localhost:3000`

### Chạy trực tiếp

```bash
node server.js
```

## Sử dụng

1. Truy cập `http://localhost:3000`
2. Lần đầu: nhập username/password để tạo tài khoản admin
3. Upload media và tổ chức theo danh mục
4. Chia sẻ link slideshow cho TV: `http://<IP>:3000/slideshow.html`

## Cấu trúc

```text
├── server.js        # Backend Node.js
├── index.html       # Trang quản lý
├── slideshow.html   # Trang trình chiếu (cho TV)
├── api.js           # API client
├── app.js           # Logic ứng dụng
├── db.js            # IndexedDB manager
├── uploads/         # Thư mục chứa media (tự tạo)
└── data.json        # Dữ liệu ứng dụng (tự tạo)
```

## License

MIT
