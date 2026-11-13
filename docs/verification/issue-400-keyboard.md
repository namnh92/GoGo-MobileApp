# GoGo-MobileApp #400 — Android GoGo AI keyboard

Ngày kiểm tra: 2026-11-13. Phạm vi: UI route GoGo AI toàn màn hình sau #628.
Worktree: `dev/worktrees/mobile-400`. Branch/base do người giao việc cung cấp:
`bugfix/GOGO-400-ai-android-keyboard`, `origin/re-design` tại `0ec27a61`.
Không chạy lệnh git; không tự xác minh branch/SHA, commit hoặc push.

## Nguyên nhân

`src/features/assistant/assistant.view.tsx` truyền `behavior="padding"` cho iOS,
nhưng `undefined` cho Android. Trong RN 0.81.5,
`KeyboardAvoidingView` vẫn nhận sự kiện keyboard nhưng nhánh render mặc định
không áp dụng chiều cao/padding/position để tránh IME. Vì vậy footer nằm ở đáy
khung chat kể cả khi bàn phím che phần dưới.

Kiểm tra cấu hình hiện tại:

- `package.json`: Expo `~54.0.37`, React Native `0.81.5`.
- `app.config.ts`: không override `android.edgeToEdgeEnabled` hoặc
  `android.softwareKeyboardLayoutMode`; các config plugin của repo không đặt
  soft-input mode hay tắt edge-to-edge. Không có thư mục native `android/`
  trong worktree để kiểm tra manifest của binary đã cài trên thiết bị.
- Mã prebuild đã cài (`@expo/prebuild-config` 54.0.9,
  `build/plugins/unversioned/edge-to-edge/withEdgeToEdge.js`) dùng
  `raw_edgeToEdgeEnabled !== false`: cấu hình này bật edge-to-edge.
- `@expo/config-plugins`, `build/android/WindowSoftInputMode.js` mặc định dùng
  `adjustResize`. Không thể dựa vào mặc định đó để giữ composer trên IME khi
  window edge-to-edge không resize. [Hướng dẫn keyboard của Expo](https://docs.expo.dev/guides/keyboard-handling/)
  xác nhận cần keyboard avoidance rõ ràng trong trường hợp này.

Đây là chẩn đoán từ code/cấu hình và regression mô phỏng window không resize,
chưa phải xác nhận cấu hình native hoặc tọa độ trên SM-A226B.

## Thay đổi

- Android dùng `KeyboardAvoidingView` behavior `height`: RN giảm chiều cao
  container theo phần chồng lấp với IME, nhường chỗ cho cả input, Send và credit.
- Giữ iOS `padding`, offset toàn màn hình `0`, bố cục footer và inset hiện tại.
- Giữ view/style split; không thay đổi API, business logic, nội dung hoặc token.
  Hành vi tự dismiss/blur sau khi bấm Send vẫn giữ nguyên; người dùng không cần
  tự đóng bàn phím trước khi gửi.
- Cập nhật assertion ownership footer và thêm assertion iOS vẫn dùng `padding`.

## Regression FAIL trước / PASS sau

Test mới: `src/features/__tests__/assistant-android-keyboard.spec.tsx`.
Test bỏ mock mặc định của `KeyboardAvoidingView`, chạy component RN thật với
Platform Android và sự kiện `keyboardDidShow` / `keyboardDidHide`.
Window mô phỏng giữ nguyên 844pt, container y=100/h=744, IME bắt đầu y=500:
container phải giảm còn 400pt (`flex: 0`). Đây là tọa độ logic fixture, không
phải số đo SM-A226B. Test còn kiểm tra credit nằm trong container, inset dưới
bằng 0 khi mở IME, draft nhận nội dung, Send gọi backend trước sự kiện hide,
và inset trở lại sau hide.

Trước khi sửa production code:

```text
pnpm test:ui --runInBand src/features/__tests__/assistant-android-keyboard.spec.tsx
FAIL src/features/__tests__/assistant-android-keyboard.spec.tsx
expect(instance).toHaveStyle()
- Expected: flex: 0; height: 400;
+ Received: flex: 1;
Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
```

Sau khi sửa:

```text
pnpm test:ui --runInBand src/features/__tests__/assistant-android-keyboard.spec.tsx src/features/__tests__/assistant-keyboard-offset.spec.tsx
PASS src/features/__tests__/assistant-android-keyboard.spec.tsx
PASS src/features/__tests__/assistant-keyboard-offset.spec.tsx
Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
```

## Quality gates

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0; 0 errors, 4 warnings `no-require-imports` có sẵn ở các test keyboard-offset/usage-footer |
| `pnpm test` (Vitest) | FAIL, exit 1; 152 files passed, 1 failed, 1 skipped; 1.811 tests passed, 3 failed, 39 skipped (1.853 total) |
| `pnpm exec vitest run src/features/assistant/__tests__/credit-footer.test.ts` | PASS; 1 file, 2 tests |
| `pnpm test:ui --runInBand` (full Jest) | PASS, exit 0; 259 suites, 3.983 tests passed, 0 failed; 328,789 giây |

Ba lỗi Vitest đều ở `src/shared/config/__tests__/distribute-wrapper.test.ts`:

- `refuses while the owner is alive`: `.stdout.trim()` gặp `undefined` tại dòng 208.
- `refuses recovery while a recorded build process group is still alive`: exit 0 thay vì khác 0 tại dòng 234.
- `keeps the lock and run files when a recorded build group is still alive after the child exits`: exit 0 thay vì khác 0 tại dòng 258.

Các test này cần xem process/start time/process group của máy. Kiểm tra độc lập
trong cùng sandbox xác nhận `spawnSync('ps', ...)` trả `status: null`,
`error: EPERM`; `pgrep` trả exit 3, `sysmon request failed with error: sysmond
service not found` / `Cannot get process list`. `scripts/distribute.sh` dùng
`ps` trong `proc_start` và `pgrep` trong `surviving_groups`. Những hạn chế này
giải thích các lỗi process/lock; không sửa hoặc skip chúng để làm xanh gate.
Toàn bộ quality gate vì vậy **chưa xanh** trong môi trường này.

Log local của lượt kiểm tra: `/tmp/issue-400-before.log`,
`/tmp/issue-400-after.log`, `/tmp/issue-400-typecheck.log`,
`/tmp/issue-400-lint.log`, `/tmp/issue-400-vitest.log`,
`/tmp/issue-400-footer.log`, `/tmp/issue-400-jest.log`.

## Device AC — chưa đo, chưa accepted

**AC trên Samsung SM-A226B / Android 13 vẫn cần đo trên build có bản sửa.**
Jest không chạy native layout/IME và không chứng minh vị trí thực tế của chữ,
input, nút Send hoặc credit trên thiết bị.

Khi nghiệm thu, ghi build SHA, flavor/environment, phiên bản bàn phím,
chế độ điều hướng và tọa độ accessibility/screenshot khi bàn phím mở:

1. Mở GoGo AI, chạm “Hỏi GoGo bất cứ điều gì…”.
2. Nhập nội dung; xác nhận chữ nhìn thấy, toàn bộ input, Send và credit footer
   nằm phía trên mép trên IME. Đo lại ở cả màn welcome và conversation.
3. Bấm Send khi IME đang mở; xác nhận gửi thành công mà không tự đóng IME trước.
4. Mở/đóng lại IME, kiểm tra footer trở về vị trí và inset đúng, không có khoảng
   trống thừa; kiểm tra thêm input nhiều dòng và chuyển cỡ bàn phím.

Rollback UI: khôi phục nhánh Android behavior trước bản sửa; không có thay đổi
schema, contract hay dữ liệu cần rollback.
