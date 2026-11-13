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
| `pnpm test` (Vitest) | PASS (DEV ngoài sandbox); 153 files passed, 1 skipped; 1.814 tests passed, 39 skipped |
| `pnpm exec vitest run src/features/assistant/__tests__/credit-footer.test.ts` | PASS; 1 file, 2 tests |
| `pnpm test:ui --runInBand` (full Jest) | PASS, exit 0; 259 suites, 3.983 tests passed, 0 failed; 328,789 giây |

DEV chạy `pnpm test` ngoài sandbox trên head
`1a3b32074d1be031bc0014699b5f8ce8b547cc8a`: 153 files passed, 1 skipped;
1.814 tests passed, 39 skipped. Quality gates PASS theo kết quả DEV này và
các kết quả typecheck/lint/Jest ở trên.

Ba lỗi Vitest ở `src/shared/config/__tests__/distribute-wrapper.test.ts`
trong lượt sandbox trước đó là lỗi môi trường: sandbox chặn truy vấn
process (`ps`: `EPERM`; `pgrep`: không lấy được process list). Lượt DEV ngoài
sandbox đã PASS; không sửa hoặc skip test để làm xanh gate.

Log local của lượt kiểm tra: `/tmp/issue-400-before.log`,
`/tmp/issue-400-after.log`, `/tmp/issue-400-typecheck.log`,
`/tmp/issue-400-lint.log`, `/tmp/issue-400-vitest.log`,
`/tmp/issue-400-footer.log`, `/tmp/issue-400-jest.log`.

## Device AC — PASS trên Android emulator

Theo quyết định owner ngày 2026-11-13, dùng emulator thay cho SM-A226B.
Số đo và bảng dưới đây được chép từ
`/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-400/emu/MEASUREMENT.md`.
Screenshots và node dumps nằm trong thư mục
`/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-400/emu/` (số file theo bảng).

- Build: debug dev client from worktree mobile-400 head 1a3b32074d1be031bc0014699b5f8ce8b547cc8a (branch bugfix/GOGO-400-ai-android-keyboard), JS served by Metro :8087, EXPO_PUBLIC_ASSISTANT_MOCK=off (verified inlined "off" in bundle), API https://api-dev.gogo.id.vn/v1 (DEV BE 2c7bfdc).
- Device: AVD gogo218, sdk_gphone64_arm64, Android 14 (API 34), Physical size: 1080x2400, gesture navigation, Gboard. Account: DEV test account "Bình Test GoGo".
- Note: first pass (files 10–14) ran with the dev mock assistant backend (default ON in dev debug builds); layout identical, reply was scripted. Real-backend pass = files 20–22.

| Step | Keyboard | Input bounds | Send bounds | Credit footer | Result |
|---|---|---|---|---|---|
| GoGo AI opened (20) | hidden | [213,1941][795,2055] | [934,1942][1050,2058] | y 2160–2281 | — |
| Tap input, type "Pizza 4Ps Ben Thanh may gio mo cua" (21) | shown, IME content top y=1389 (keys from ~1515) | [213,1065][795,1235] | [934,1123][1050,1239] | y 1341–1462 | input, Send, footer above keyboard; typed text visible — PASS |
| Tap Send with keyboard shown (22) | shown → hidden after send | — | — | free sends 1/5 → reply | message sent without closing keyboard; DEV place_qa confirm reply with Pizza 4P's cards — PASS |

AC #400 on Android emulator: PASS. SM-A226B not measured (owner decision 2026-11-13).

Rollback UI: khôi phục nhánh Android behavior trước bản sửa; không có thay đổi
schema, contract hay dữ liệu cần rollback.
