# VSBTek-MediaCast

Hệ thống quản lý và trình chiếu media cho quảng bá sản phẩm và sự kiện.

## Tính năng

- Upload file media (hình ảnh, video)
- Quản lý thư viện media với danh mục
- Tìm kiếm và lọc media
- Chế độ trình chiếu slideshow với hiệu ứng chuyển cảnh
- Giao diện responsive, hiện đại

## Cách sử dụng

1. Mở [index.html](index.html) trong trình duyệt
2. Hoặc chạy: `npm start` để khởi động local server

## Công nghệ

- HTML5, CSS3, JavaScript (Vanilla)
- **IndexedDB** để lưu trữ dữ liệu (dung lượng lớn, tốc độ nhanh)
- Lưu trữ file dạng Blob (tiết kiệm ~33% so với Base64)
- Responsive design
- Auto-migration từ LocalStorage (nếu có dữ liệu cũ)

## Dung lượng lưu trữ

- IndexedDB: ~50MB - vài GB (tùy trình duyệt)
- Phù hợp cho server nội bộ với hàng trăm/ngàn media files
