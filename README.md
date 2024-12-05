# CMC Translate Extension

## Giải thích các trường trong `manifest.json`

- **`name`**: Tên của extension.
- **`version`**: Phiên bản hiện tại của extension, theo định dạng `MAJOR.MINOR.PATCH`.
- **`manifest_version`**: Phiên bản của manifest. Ở đây sử dụng phiên bản 2 (chuẩn cũ).
- **`description`**: Mô tả ngắn gọn về mục đích của extension.
- **`icons`**: Định nghĩa các biểu tượng được sử dụng bởi extension ở các kích thước khác nhau.
- **`browser_action`**:
  - `default_icon`: Định nghĩa icon cho thanh công cụ của trình duyệt.
  - `default_title`: Tooltip hiển thị khi di chuột vào icon.
  - `default_popup`: Định nghĩa tệp HTML sẽ hiển thị khi người dùng nhấp vào icon.
- **`background`**:
  - `page`: Đường dẫn tới tệp HTML chạy nền.
  - `persistent`: Nếu là `false`, sử dụng event pages (tiết kiệm tài nguyên).
- **`content_scripts`**: 
  - `matches`: URL mà content script được áp dụng.
  - `js`: Tệp JavaScript được inject vào trang.
  - `css`: Tệp CSS được inject vào trang.
  - `run_at`: Thời điểm script được chạy.
- **`permissions`**:
  - `clipboardWrite`: Cho phép ghi dữ liệu vào clipboard.
  - `storage`: Cho phép sử dụng API lưu trữ cục bộ của trình duyệt.

## Ghi chú
File `manifest.json` không hỗ trợ comments, vì vậy hãy tham khảo tệp README này để hiểu chi tiết các trường.
