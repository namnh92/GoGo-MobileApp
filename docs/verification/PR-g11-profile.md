# G11 — Hồ sơ & cài đặt (#529)

## Phạm vi và nguồn

- Worktree `mobile-g11`, branch `feature/GOGO-529-redesign-g11-profile`, base `c9043b3` (`re-design`). Không commit/push.
- Nguồn giao diện: đã đọc cả HTML và PNG của `dev/handoffs/stitch-g11/11.1` đến `11.5`; kế hoạch `dev/handoffs/g11-plan.md` §1, §2, §4.
- Quyết định owner **2026-11-08**: [#529 comment 6710656834](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), được cung cấp trực tiếp trong task.
- Light theo bố cục Stitch và semantic tokens hiện có. Dark theo tokens, ngoại lệ owner **2026-11-07** tại [#529](https://github.com/namnh92/GoGo-MobileApp/issues/529). Không có cặp Dark riêng trong bộ local.
- Không thay OpenAPI, endpoint, authorization hoặc cơ chế phiên/cache. Dùng các hook và DTO được sinh hiện có.

## Stitch → app

| Stitch | App / nguồn dữ liệu | Kiểm chứng tự động |
|---|---|---|
| 11.1 Khách | Header GoGo/Cá nhân + chuông; hồ sơ khách; card đăng nhập cho cả anonymous và guest; shortcuts theo quyền hiện hành; Quyền và Màu dùng được không cần tài khoản | `profile-keo-count.spec.tsx`: không lộ profile cache cho guest, khoá Saved/Reviews với lý do + CTA; Kèo vẫn mở Sắp tới |
| 11.2 User | Avatar/tên/email từ `/me`, thành phố từ `homeAdministrativeArea.provinceName`, chip mood có nhãn taxonomy; Saved/Reviews là độ dài mảng đầy đủ; giữ Đóng góp | Kiểm tra nhãn taxonomy, số 0 thật, không placeholder, không tổng Kèo hoặc badge unread |
| 11.2 Banner | Room có lịch tương lai gần nhất từ **toàn bộ các trang** `/rooms` ở trạng thái Sắp tới hiện có; so `startAt`, fallback `scheduledDate`; bỏ lịch thiếu/sai/quá khứ và trạng thái kết thúc | `profile-upcoming.spec.tsx`: trang sau có room gần hơn, pagination lỗi/retry, không lộ cache sau đổi actor |
| 11.2 Đích banner | Ready/active có `planId` → plan; phòng còn quyết định hoặc chưa có plan → lobby, cùng semantics màn Kế hoạch | Test cả hai đích |
| 11.3 Mặc định | Route riêng `/settings/defaults`; intro → một khu vực hành chính → ngân sách radio / người → mood chips + số đã chọn → CTA; chỉ PATCH trường thay đổi | `account-defaults.spec.tsx`: payload chuẩn tỉnh/phường/version, clear null, custom budget giữ nguyên khi chỉ đổi mood, lỗi giữ draft |
| 11.4 Màu | Route riêng `/settings/theme`; bốn swatch có tên/mô tả/check; preview trong `ScopedTheme`; Apply mới lưu AsyncStorage key hiện có và đổi runtime; thành công/lỗi qua ResultSheet | `account-theme-accent.spec.tsx`: chọn chưa lưu, rời màn không lưu, Apply, bootstrap muộn, storage lỗi + retry, preview không có button |
| 11.5 Quyền | Header back + chuông, intro, các section account/OS/device hiện có, card mở Settings hệ thống có lỗi riêng, metadata phiên bản thật | Các suite notifications/location/device promotions/tracking/settings-permissions |
| Đăng xuất/xoá | Secondary logout + Sheet xác nhận; huỷ không gọi provider; lỗi logout giữ nguyên phân loại và actor tagging; delete trong Account giữ xác nhận, nền card trung tính | `profile-sign-out-failure.spec.tsx`, `profile-keo-count.spec.tsx`, các suite session/logout/account |
| Điều hướng/quan sát | Route files là thin re-export, shared settings shell; thêm hai route vào danh sách screen template được phép | `screen-tag.spec.tsx`, `i18n-keys.spec.tsx` |

## Sai khác có chủ đích / quyết định owner

1. **2026-11-08 — #529 / [GoGo-BE#809](https://github.com/namnh92/GoGo-BE/issues/809):** ẩn tổng Kèo, unread count, uy tín/cấp/check hồ sơ. Không lấy số trang đầu làm tổng, không dấu gạch hay số 0 giả. Kèo vẫn là lối mở Sắp tới, không có số. Chuông G11 không hiện dot hay đọc số unread; các header ngoài G11 giữ behavior hiện có.
2. **2026-11-08 — #529:** tách Defaults/Theme khỏi Account được owner chấp thuận. Giữ các route Account, Permissions, Saved, Reviews, Contributions và hành vi mở Kèo hiện có.
3. **2026-11-08 — #529 / [#524](https://github.com/namnh92/GoGo-MobileApp/issues/524):** chỉ một `homeAdministrativeArea`, dùng administrative picker hiện có; không GPS mặc định, không ba khu vực ghim; không ghi đè current area toàn app. Giữ legacy area đã có cho đến khi người dùng thay/xoá.
4. **2026-11-08 — #529:** giữ toàn bộ budget tiers hiện hành, trạng thái chưa đặt và giá trị custom từ BE. Không diễn giải null thành “không giới hạn”, không chuyển upper bound thành schema range. Mood giữ stable keys, tối đa 5 như trước.
5. **2026-11-08 — #529:** preview là minh hoạ được ghi rõ, không tương tác. Không dùng tên quán/giờ/Google rating/ảnh từ mẫu như dữ liệu thật. Dùng tile minh hoạ, nút và tab mô phỏng bằng View; tab mẫu khớp bốn tab thật, không thêm Bản đồ. Swatch chỉ đổi preview; lưu thất bại không báo thành công hoặc đổi màu toàn app.
6. **2026-11-08 — #529 / [GoGo-BE#810](https://github.com/namnh92/GoGo-BE/issues/810), [GoGo-CMS#290](https://github.com/namnh92/GoGo-CMS/issues/290):** không thêm FAQ, feedback, báo lỗi, About, policy links hoặc cam kết riêng tư chưa có nguồn CMS. Không thêm dòng “Đã đồng bộ”, nút `…` hay lời hứa camera/micro/storage chưa có định nghĩa. Metadata phiên bản lấy từ build; không dùng Saigon Edition/version mẫu. Giữ disclosure SDK hiện có cần cho consent thực tế; không thay bằng cam kết trái dữ liệu SDK. GoGo AI vẫn là entry riêng theo feature gate hiện có, không giả làm FAQ/góp ý CMS.
7. **2026-11-08 — #529 / [#525](https://github.com/namnh92/GoGo-MobileApp/issues/525), [#526](https://github.com/namnh92/GoGo-MobileApp/issues/526):** không đổi pipeline account switch/logout, push confirmation, thu hồi session hoặc cache purge; chỉ thêm xác nhận secondary. Dialog chưa xác nhận không được mang sang actor khác.
8. **2026-11-07 — #529:** Dark dùng cùng layout/nội dung, tokens theo mode. Shared Sheet/ResultSheet giữ animation/reduced motion hiện có; không thay primitives.

## Kết quả chạy

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS, exit 0 (`/tmp/g11-typecheck-last.log`) |
| `pnpm lint` | PASS, exit 0; không error/warning (`/tmp/g11-lint-last.log`) |
| `pnpm test` | FAIL do sandbox: 134 files pass, 1 file fail, 1 skipped; 1.573 tests pass, 3 fail, 39 skipped (`/tmp/g11-test-final.log`) |
| `pnpm test:ui --runInBand` | PASS: 194 suites / 2.334 tests (`/tmp/g11-ui-final.log`) |
| UI sau chỉnh cuối | PASS: 13 suites / 85 tests trên chỉnh sửa cuối, gồm reset dialog theo actor và canvas Light (`/tmp/g11-ui-last.log`) |
| `git diff --check` | PASS |

Ba failure thuần TypeScript đều ở `src/shared/config/__tests__/distribute-wrapper.test.ts`:

- `refuses while the owner is alive` — output `ps` bị sandbox từ chối, `.stdout` không có để `.trim()`.
- `refuses recovery while a recorded build process group is still alive` — không quan sát được process group đang sống.
- `keeps the lock and run files when a recorded build group is still alive after the child exits` — cùng giới hạn quan sát process group.

Đã xác nhận trực tiếp `/bin/ps -o lstart= -p $$` trả `operation not permitted`. Script và test distribution-wrapper không đổi trong diff. Không claim cả bốn gate xanh; cần chạy lại `pnpm test` trên host có quyền process inspection. Log lệnh trong `/tmp/g11-*.log` là evidence local tạm, không chứa giá trị secrets. Full UI suite được bổ sung bằng targeted rerun trên chỉnh sửa cuối; không claim native acceptance.

## Giới hạn kiểm chứng / câu hỏi mở

- Chưa có ảnh app native chứa dirty patch đặt cạnh Stitch. Chưa đo độc lập 5 màn × Light/Dark, SE, chữ lớn, VoiceOver/TalkBack và contrast trên thiết bị. Unit/UI renderer tests không được coi là chứng nhận pixel parity hay DEV acceptance.
- `pnpm test` trong sandbox hiện không đọc được `/bin/ps` (`operation not permitted`). Ba test distribution-wrapper về owner sống và process group sống thất bại; file/suite này không được sửa hoặc skip để tạo kết quả xanh.
- Không có câu hỏi nghiệp vụ đang chặn G11 đã được giao. Các aggregate và nội dung CMS tiếp tục chờ #809/#810/#290 và đang ẩn. Visual acceptance và chạy lại suite process trên host có quyền vẫn còn cần thực hiện.

## Theo dõi / rollback

- Giữ events `profile_defaults_saved`, `theme_accent_changed`, `auth_signed_out`, `auth_sign_out_failed`; không gửi nội dung hồ sơ trong event mới. Thêm screen templates cho hai route mới.
- Không dependency/migration/API mới. Rollback bằng bỏ patch G11 trong review, giữ nguyên base; chưa có commit hoặc tác động remote để hoàn tác.
