# BẢNG ĐIỀU TRA CƠ SỞ VẬT CHẤT VKU
> **Hướng dẫn:** Phiếu điều tra hiện trạng phòng học, phòng lab và hạ tầng cơ sở tại Đại học VKU. Các câu hỏi có thể thay đổi linh hoạt bằng cách chỉnh sửa nội dung trong file markdown này.

---

## 1. Thông tin chung
Khai báo vị trí và đối tượng khảo sát trước khi tiến hành kiểm tra thiết bị.

### Q1: Tòa nhà & Số phòng
- Type: text
- Required: true
- Placeholder: Ví dụ: Tòa nhà C - Phòng 204 (C204)
- Info: Nhập đúng tên tòa nhà và số phòng để hệ thống tự động đối chiếu với danh mục tài sản VKU.

### Q2: Loại khu vực khảo sát
- Type: select
- Options: [Phòng học Lý thuyết, Phòng máy tính / Lab, Ký túc xá, Văn phòng Khoa, Hội trường / Căn tin, Khu vực ngoài trời]
- Required: true
- Info: Chọn đúng phân loại để áp dụng danh mục kiểm tra tiêu chuẩn.

---

## 2. Kiểm tra Thiết bị & Hạ tầng
Đánh giá chi tiết tình trạng thực tế của từng thiết bị trong khu vực.

### Q3: Tình trạng Máy chiếu & Màn chiếu
- Type: radio
- Options: [Hoạt động tốt, Hình ảnh mờ / Sai màu, Không lên nguồn, Thiếu cáp kết nối (HDMI/VGA), Không có thiết bị]
- Required: true
- Info: Bật thử máy chiếu, kiểm tra dây tín hiệu HDMI trên bàn giảng viên và điều khiển từ xa.

### Q4: Hệ thống Điều hòa & Quạt gió
- Type: select
- Options: [Hoạt động bình thường, Không làm lạnh / Kém mát, Chảy nước / Tiếng ồn lớn, Điều khiển hết pin / Mất, Hỏng hoàn toàn]
- Required: true
- Info: Kiểm tra xem các dàn lạnh có hoạt động đồng đều và không bị rò rỉ nước xuống sàn.

### Q5: Số lượng máy tính hoạt động tốt (Nếu là phòng Lab)
- Type: number
- Placeholder: Ví dụ: 42
- Info: Kiểm tra số máy khởi động thành công vào hệ điều hành và có kết nối mạng LAN/Internet.

### Q6: Tình trạng Bàn ghế & Hệ thống chiếu sáng
- Type: checkbox
- Options: [Bàn ghế đầy đủ & nguyên vẹn, Có bàn ghế hỏng/gãy, Đèn chiếu sáng hỏng/nhấp nháy, Ổ cắm điện bàn máy bị hỏng, Cửa sổ/Cửa chính khó khóa]
- Info: Tích chọn tất cả các sự cố ghi nhận được tại thời điểm điều tra.

---

## 3. Ghi nhận Thực địa & Đánh giá
Cung cấp minh chứng hình ảnh và mức độ ưu tiên xử lý cho ban quản lý VKU.

### Q7: Mức độ ưu tiên xử lý sự cố
- Type: select
- Options: [Bình thường (Bảo trì định kỳ), Trung bình (Xử lý trong 3-5 ngày), Cao (Xử lý trong 24h), Khẩn cấp (Ảnh hưởng trực tiếp buổi học)]
- Required: true
- Info: Sự cố khẩn cấp bao gồm hỏng điện gây nguy hiểm, máy chiếu hỏng trước giờ thi, v.v.

### Q8: Chụp ảnh hiện trạng / Tang vật hỏng hóc
- Type: photo
- Info: Hỗ trợ chụp trực tiếp từ camera điện thoại hoặc tải ảnh từ thư viện thiết bị.

### Q9: Ghi chú chi tiết của người điều tra
- Type: textarea
- Placeholder: Nhập chi tiết các hư hỏng hoặc đề xuất vật tư thay thế nếu có...
- Info: Cung cấp thêm mô tả vị trí chính xác của thiết bị hỏng (ví dụ: Máy chiếu dãy bàn 3 bên trái).
