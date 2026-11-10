# GoGo-MobileApp #607 — Ô link dùng chung với màn Thêm địa điểm mới

Phạm vi: re-design UI, owner addendum 2026-11-10. Không chạy git.

## Thay đổi

- `src/shared/ui/link-input.view.tsx` + `.style.tsx`: một field chung cho Saved
  và place-import, lấy nguyên hình học của field import: cao 52, icon map-pin
  ở trái, padding trái/phải 40/48, nền `surface.low`, viền `border.neutral`,
  bo góc `radius.compact`, chữ `bodySmall`, màu từ role token Light/Dark.
- Khi chưa focus, hiển thị một dòng với `ellipsizeMode="tail"`; overlay không
  nhận chạm và không lặp nội dung với screen reader. Khi focus, editor một dòng
  cuộn ngang, giữ toàn bộ URL; không ép lineHeight để tránh wrap trên iOS.
- Nút x có đĩa tròn 24, màu `surface.highest`, vùng chạm 44×44 và
  `accessibilityLabel` qua i18n `placeImport.clearLink`. Disable theo `editable`.
- Saved bỏ icon link và style field riêng; nút Lưu cao bằng field (52).
  Luồng Lưu, pending, session/blur guard và lỗi không đổi. Xoá vẫn focus lại input.
- Import dùng component chung; validation badge/hint, error border, clipboard,
  focus/reveal, exit guard và callback xoá/reset vẫn do màn hình quản lý.

## Bằng chứng hồi quy

- `src/shared/ui/__tests__/link-input.spec.tsx`: render thực factory style Light/Dark,
  kiểm hình học/màu role, icon, ellipsis, focus/blur, edit, empty, error và disabled
  clear; overlay được ẩn khỏi accessibility tree.
- `src/features/__tests__/saved-link.spec.tsx`: URL dài/ellipsis, clear/focus,
  disable Lưu khi trống, chiều cao 52; kiểm factory Light/Dark. Giữ các test
  hành vi lưu, handoff, lỗi và phản hồi muộn khi blur/session thay đổi.
- `src/features/__tests__/place-import-owner.spec.tsx`: giữ test paste/focus/blur,
  clear và wizard reset; thêm kiểm invalid-link/clear và error/surface role Light/Dark.
- Focused: PASS, 3 suites, 87 tests.

Kết quả cuối ngày 2026-11-10:

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0, không warning |
| `pnpm test:ui --runInBand` | PASS, exit 0; Test Suites: 235 passed, 235 total; Tests:       3450 passed, 3450 total; Snapshots:   11 passed, 11 total |

Log: `/tmp/mobile-607-addendum-{typecheck,lint,focused,ui-final}.log`.

## Owner kiểm simulator — chưa thực hiện

Trên build chứa bản sửa, kiểm cả Light và Dark ở Saved và Thêm địa điểm mới:

1. Dán cùng URL Google Maps dài: cùng icon map-pin, hình học, nền/viền/màu,
   nút x; chưa focus có dấu …, focus sửa/cuộn ngang, không xuống dòng.
2. Bấm x: Saved trống, focus ở input, Lưu disable; Import reset theo luồng cũ.
3. Lưu một địa điểm có sẵn và mở import cho link mới; pending không thể xoá.
4. Link sai ở import vẫn có validation/error như cũ; VoiceOver đọc “Xóa liên kết”.

Chưa xác nhận nghiệm thu native bằng test component.
