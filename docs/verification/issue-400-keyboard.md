# GoGo-MobileApp #400 — Android GoGo AI keyboard

Ngày kiểm tra: 2026-11-13. Phạm vi: UI route GoGo AI toàn màn hình sau #628.
Worktree: `dev/worktrees/mobile-400`. Branch/base do người giao việc cung cấp:
`bugfix/GOGO-400-ai-android-keyboard`, `origin/re-design` tại `0ec27a61`.
Không chạy lệnh git; không tự xác minh branch/SHA, commit hoặc push.

## Vòng 3 — F-03 P1: bỏ lỡ keyboardDidHide (2026-11-13)

Review request: `dev/handoffs/codex-review-request-mobile-400-r3.dev.out`.
Head được giao: `a5611bd0` (theo owner/review request; không chạy git để xác minh).
Chỉ sửa UI trong worktree này; giữ view/style split, không thay style hoặc iOS.

### Finding và bản sửa

F-03: KAV và `useKeyboardVisible()` cùng chờ `keyboardDidHide`. Nếu hook
bỏ lỡ sự kiện, `keyboard` vẫn true: KAV còn padding và footer thiếu safe-area
inset, dù snapshot `Keyboard.isVisible()` đã trở về false.

- Shared hook bổ sung `syncAndroidKeyboardVisibility()`: đọc lại
  `Keyboard.isVisible()`, chỉ cập nhật khi snapshot khác trạng thái đang giữ,
  và thông báo tất cả consumer đang subscribe. Không chỉ cập nhật consumer
  của màn hình đang layout/focus.
- Android đồng bộ khi AppState chuyển `active`; tháo listener khi unmount.
  GoGo AI cũng gọi đồng bộ khi route nhận focus và khi KAV layout lại, kể cả
  layout do đổi view hoặc hệ thống đóng IME mà không phát hide tới consumer.
- Khi snapshot hidden, props hiện có tắt avoidance và trả inset footer;
  không phát hide giả, không đổi Send/dismiss, API hoặc business logic.
- iOS: hàm đồng bộ là no-op, không đăng ký AppState listener mới; vẫn dùng
  will-events trước animation, KAV padding/offset 0/always enabled như cũ.
  Các consumer khác giữ nguyên API và show/hide semantics; Android chỉ nhận
  hiệu chỉnh trạng thái bàn phím khi snapshot đã thay đổi.

Giới hạn: `Keyboard.isVisible()` là snapshot RN, không phải truy vấn IME native
độc lập. Bản sửa xử lý trường hợp snapshot đã false nhưng hook bỏ lỡ hide;
không khẳng định tự phát hiện được nếu chính snapshot RN cũng còn stale.

### Regression FAIL trước / PASS sau

Thêm ba case `resume`, `layout`, `focus` vào
`src/features/__tests__/assistant-android-keyboard.spec.tsx`, dùng KAV RN thật:

1. Layout y=100/h=744, show IME y=500 → padding 344, inset footer 0.
2. **Không phát `keyboardDidHide`**. Cho `Keyboard.isVisible()` trả false;
   lần lượt mô phỏng background → active, layout lại, hoặc nhận lại focus.
3. Yêu cầu padding 0, flex 1, inset footer 34; layout muộn cũng không áp lại
   show payload còn lưu trong KAV.

Chạy test mới trước khi sửa production code trên worktree được giao:

```text
FAIL assistant-android-keyboard.spec.tsx
resume / layout / focus:
Expected: paddingBottom: 0
Received: paddingBottom: 344
Test Suites: 1 failed, 1 total
Tests: 3 failed, 2 passed, 5 total
```

Sau sửa, cả ba case PASS. Bổ sung kiểm tra consumer hook thứ hai cũng được
đồng bộ, layout khi snapshot vẫn visible không làm mất avoidance, và snapshot
false không ghi đè iOS will-show. Hai test Send/hide native trước đó giữ nguyên.
Focused cuối cùng: 5 suites / 46 tests PASS (Android, offset iOS, shared
keyboard, sheet, assistant usage-footer). Giữ nguyên thứ tự hai callback focus
refetch hiện có; callback đồng bộ mới đăng ký sau chúng để bảo toàn các test
focus refresh credit hiện tại.

### Quality gates vòng 3

| Lệnh | Kết quả vòng 3 |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0; 0 errors, 4 warnings `no-require-imports` có sẵn ở keyboard-offset/usage-footer |
| `pnpm test:ui --runInBand` | PASS, exit 0; 259 suites, 3.987 tests, 11 snapshots; 235,752 giây |
| `pnpm exec vitest run src/features/assistant/__tests__/credit-footer.test.ts` | PASS; 1 file, 2 tests |

Log: `/tmp/issue-400-r3-{before,focused,typecheck,lint,footer,jest}.log`.
Chưa chạy lại emulator/device AC vòng 3; bằng chứng device vòng 2 phía dưới
chỉ xác nhận flow show/hide thông thường, không thay thế regression missed-hide.

## Vòng 2 — Regression sau khi đóng keyboard (2026-11-13)

Owner giao sửa trên branch `bugfix/GOGO-400-ai-android-keyboard`, head
`145c3742` (thông tin được cung cấp; không chạy git để xác minh).
Phạm vi chỉ UI, không dependency mới; iOS giữ hành vi cũ và giữ view/style split.

### Defect và bằng chứng owner

Pixel AVD Android 14, 1080×2400, density 420, gesture navigation;
nav bar inset bottom 63px, frame `[0,2337][1080,2400]`:

- Trước IME: input `[213,1941][795,2055]`, footer credit kết thúc y=2281.
- IME mở: input `[213,1065][795,1235]`, tránh bàn phím được.
- Sau Send/hide và nhiều phút sau: input `[213,1750][795,1864]`, footer
  kết thúc y=2090; vẫn cao hơn ban đầu 191px. Lượt khác input bắt đầu y=1811.

Evidence owner cung cấp trong
`/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-400/emu/`:
`20-nodes.txt`, `21-nodes.txt`, `22-nodes.txt`, `30-now-nodes.txt`,
`30-now.png`, `22-real-after-send.png`.

### Root cause từ mã RN đã cài

Trong `node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js`
(RN 0.81.5), Android đăng ký `keyboardDidHide` bằng `_onKeyboardChange`,
giữ hide event để tính overlap; chỉ iOS dùng `_onKeyboardHide` để xóa event.
Nhánh `height` tính `max(state.bottom + frame.y + frame.height - keyboardY, 0)`:
phụ thuộc cả bottom cũ và thứ tự layout callback của khung đang bị co.
Hide không bảo đảm reset bottom về 0.

Native `ReactAndroid/src/main/java/com/facebook/react/ReactRootView.java`
phát hide với `screenY = mVisibleViewArea.height()` và keyboard height 0.
Đây là chiều cao visible frame, không phải tọa độ mép dưới khung chat;
system bars và edge-to-edge có thể làm hai giá trị khác nhau. Vì thế stale
bottom có thể tiếp tục áp dụng sau hide. Không có bằng chứng rằng inset footer
là nguyên nhân: inset đã được hook keyboard khôi phục riêng, còn KAV vẫn co.

Test cũ phát hide bằng `{}`: thiếu tọa độ làm phép tính thành `NaN`, nhánh
`state.bottom > 0` không còn áp height, nên assertion cũ vô tình PASS.
Regression mới chạy KAV thật với hide payload đủ tọa độ, tái hiện việc không
khôi phục layout. Đây là bằng chứng cơ chế từ code/test; chưa khẳng định test
mô phỏng chính xác mức lệch 191px của emulator.

### Bản sửa

- KAV dùng `behavior="padding"`, offset 0: khung ngoài vẫn flex, phần đệm
  nhường chỗ cho IME và cả composer/credit.
- `enabled={Platform.OS !== 'android' || keyboard}`: khi Android hidden,
  avoidance bị tắt và padding trở về 0 dù tọa độ hide còn overlap; layout callback
  muộn cũng không áp lại khoảng đệm. Chỉ đổi sang padding chưa đủ vì hide native
  có thể báo visible frame ngắn hơn khung chat.
- iOS luôn enabled, vẫn behavior padding và offset 0 như trước. Footer vẫn
  sở hữu inset sau cả hai control và chỉ bỏ inset khi keyboard visible.
- Không đổi dismiss/blur khi Send, API hoặc business logic. Không thêm style
  vào view; chỉ đổi props KAV.

### Regression FAIL trước / PASS sau

`src/features/__tests__/assistant-android-keyboard.spec.tsx`:
khung y=100/h=744; show tại y=500, sau đó hide với y=820/height=0.
Test yêu cầu style sau hide bằng hệt trước show, footer inset trở lại 34;
lặp lại với IME y=460 và phát layout muộn h=720 rồi h=744.

Trước sửa production code trên worktree được giao:

```text
FAIL assistant-android-keyboard.spec.tsx
Expected: {"flex": 1}
Received: [{"flex": 1}, {"flex": 0, "height": 376}]
Tests: 1 failed, 1 passed, 2 total
```

Sau sửa: test Android mở keyboard/gửi tin vẫn kiểm tra 344pt avoidance
(744−344=400pt khả dụng), credit và Send cùng ở trong khung tránh IME.
Test offset iOS còn kiểm tra padding, offset 0 và enabled luôn true.

### Quality gates vòng 2

| Lệnh | Kết quả vòng 2 |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS; 0 errors, 4 warnings `no-require-imports` có sẵn trong test keyboard-offset/usage-footer |
| `pnpm test:ui --runInBand` | PASS; 259 suites, 3.984 tests, 11 snapshots; 179,956 giây |
| `pnpm exec vitest run src/features/assistant/__tests__/credit-footer.test.ts` | PASS; 1 file, 2 tests |

Lượt focused Android + offset sau sửa: 2 suites / 6 tests PASS.
Full Jest phía trên cũng chạy lại cả hai suite với phiên bản test cuối cùng.
Không chạy full Vitest trong vòng 2; kết quả full Vitest vòng 1 bên dưới chỉ là lịch sử.
Log: `/tmp/issue-400-round2-{before,focused,typecheck,lint,footer,jest}.log`.

### Device AC vòng 2 — PASS

Số đo lại sau bản sửa được chép từ
`/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-400/emu/r2/MEASUREMENT.md`.
Evidence nằm trong thư mục
`/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-400/emu/r2/`:
node dump `nodes.txt` và screenshots A-before / B-open / C-after-send / D-after-dismiss.

- Code head: `4ac25b2e` theo evidence, không chạy git để xác minh. KAV dùng
  `behavior="padding"`, chỉ enabled khi keyboard Android hiện. Metro :8087,
  `EXPO_PUBLIC_ASSISTANT_MOCK=off`, API DEV (BE `2c7bfdc`). App đã force-stop
  và mở lại bằng dev-client deep link sau sửa; Metro đã build lại bundle.
- Thiết bị: AVD gogo218 (`sdk_gphone64_arm64`), Android 14 / API 34,
  1080×2400, density 420, gesture navigation, Gboard;
  nav bar frame `[0,2337][1080,2400]`. Tài khoản owner, do owner đăng nhập.

| Bước | Keyboard | Input | Send | Hàng "Credit GoGo" | Kết quả |
| --- | --- | --- | --- | --- | --- |
| A. Mở GoGo AI (welcome) | ẩn | [213,1941][795,2055] | [934,1942][1050,2058] | [42,2233][255,2281] | baseline |
| B. Chạm input, nhập "CGV Dong Khoi gia bao nhieu" | hiện | [213,1065][795,1235] | [934,1123][1050,1239] | [42,1414][255,1462] | nằm trên keyboard, thấy nội dung nhập — PASS |
| C. Chạm Send khi keyboard hiện | → ẩn | [213,2002][795,2116] | [934,2003][1050,2119] | [42,2233][255,2281] | gửi thành công (free 5/5 → 4/5); footer về baseline — PASS |
| D. Mở lại keyboard, đóng bằng Back (không gửi) | ẩn | [213,2002][795,2116] | — | [42,2233][255,2281] | layout khôi phục — PASS |

Input chuyển y=1941 → 2002 giữa A và C vì dòng disclaimer chỉ có ở welcome
bên dưới composer biến mất khi đã có hội thoại; footer (bottom anchor) trở về
đúng y=2281. Sau lần mở/đóng bằng Back, input và credit giữ đúng tọa độ của
trạng thái đã có hội thoại. **AC emulator vòng 2 PASS.**
Trước bản sửa vòng 2 (head `145c3742`), cùng flow để footer kẹt tại y=2090,
lệch khoảng 191px; bằng chứng đối chiếu: `../30-now-nodes.txt` từ thư mục r2.

Rollback vòng 2: khôi phục props KAV và assertion tương ứng về bản vòng 1;
không có thay đổi schema/contract/data.

## Vòng 1 — Nguyên nhân (lịch sử)

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

## Vòng 1 — Device AC (kết quả cũ, bị regression vòng 2 thay thế)

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

Kết quả mở IME/gửi tin vòng 1 đã PASS, nhưng chưa kiểm tra việc khôi phục tọa độ sau hide.
Owner phát hiện regression bên dưới nên không còn coi đây là AC PASS toàn bộ.
SM-A226B không đo (quyết định owner 2026-11-13).

Rollback UI: khôi phục nhánh Android behavior trước bản sửa; không có thay đổi
schema, contract hay dữ liệu cần rollback.
