# GoGo-MobileApp #660 — Android form keyboard

Ngày: 2026-11-13. Vai trò: Sol DEV theo yêu cầu owner. Phạm vi chỉ UI trong
`dev/worktrees/mobile-660`. Branch do owner cung cấp:
`bugfix/GOGO-660-android-keyboard-forms`, stacked trên
`bugfix/GOGO-400-ai-android-keyboard`. Không chạy lệnh git; không tự xác minh
branch/SHA, commit hoặc push. Device AC để DEV đo trên Android emulator.

## Nguyên nhân

Expo SDK 54 Android edge-to-edge không resize cửa sổ theo IME. Cả năm view
truyền `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` nên KAV
Android nhận sự kiện nhưng không áp avoidance. ScrollView vẫn giữ viewport
đầy đủ phía sau IME: ô nhập và CTA phía dưới có thể bị che.

Phân tích RN 0.81.5 và vòng sửa #400 nằm tại
`docs/verification/issue-400-keyboard.md`. Không dùng `height`: native hide
coordinates có thể còn overlap với frame edge-to-edge, làm layout giữ gap.
Chỉ đổi sang padding cũng chưa đủ nếu avoidance vẫn bật sau hide.

## Thay đổi

Một `FormKeyboardAvoider` tại `src/shared/ui/form-keyboard-avoider.view.tsx`:

- Android dùng padding; enabled chỉ khi shared `useKeyboardVisible()` là true.
  Hide tắt avoidance nên padding về 0 cả khi KAV giữ hide payload còn overlap.
- Tái sử dụng nguyên hook `src/shared/ui/keyboard.ts` từ #400: AppState active
  đọc lại `Keyboard.isVisible()`. Wrapper cũng đồng bộ khi layout lại, rồi
  chuyển tiếp `onLayout` của caller. Không thêm keyboard state riêng.
- iOS vẫn padding, luôn enabled, giữ nguyên `keyboardVerticalOffset`, dùng
  will-events. Android sync là no-op trên iOS. Các platform khác giữ behavior cũ.
- Dùng wrapper tại sign-in, forgot-password, reset-password, join-by-code và
  wizard-step. Wizard vẫn chỉ avoid khi caller đã yêu cầu `avoidKeyboard`;
  giữ nguyên measured-header offset và cấu trúc scroll/footer.
- Bốn form đã có `keyboardShouldPersistTaps="handled"`; bước wizard type có
  ô nhập và bật avoidance cũng đã có. Giữ nguyên các thiết lập này.
- Không đổi validation, submit, API, auth/recovery/room flow, copy, token hoặc
  style. Không thêm dependency hay listener focus/navigation. Không thay hook
  hoặc màn assistant của #400. View/style split giữ nguyên.

Giới hạn: đồng bộ missed-hide dựa vào snapshot RN đã bắt kịp thực tế; không
phải truy vấn IME native độc lập. Nếu snapshot RN cũng stale, bản sửa không
khẳng định phát hiện được. Khi không có hide event, recovery cần AppState
active hoặc layout callback.

## Regression FAIL-before / PASS-after

Dùng KAV RN thật (`jest.unmock`), không phải Jest stub chỉ kiểm tra props.
Toạ độ là mô phỏng logical points, không phải số đo emulator.

1. `src/features/__tests__/form-android-keyboard.spec.tsx`: chạy khi cả năm
   production view còn nguyên base được giao. Sign-in/sign-up có viewport
   y=100/h=744; show IME tại y=500 phải tạo padding 344. FAIL cả 3 cases do
   thiếu padding (2 mode + missed-hide resume). Log `/tmp/issue-660-before.log`.
2. `src/shared/ui/__tests__/form-keyboard-avoider.spec.tsx`: vì base chưa có
   shared component, tạo wrapper baseline chỉ chuyển tiếp KAV props với đúng
   behavior cũ, chưa wire vào screen. Ba cases hide/resume/layout đều FAIL
   `Expected paddingBottom: 344; Received flex: 1` trước khi sửa wrapper.
   Log `/tmp/issue-660-shared-before.log`. Đây là characterization của rule cũ,
   không phải tuyên bố base đã chứa component này.
3. Sau sửa: 2 suites / 6 tests PASS (`/tmp/issue-660-focused.log`). Assertions:
   show → padding đúng; password và primary CTA cùng nằm trong ScrollView;
   hai chu kỳ IME y=500/460; hide native y=820/h=0 → style bằng hệt baseline;
   layout muộn không áp lại gap. Shared suite còn kiểm tra missed-hide khi
   resume/layout, layout lúc keyboard vẫn hiện, chuyển tiếp caller onLayout,
   và offset khác 0. Sign-in kiểm tra recovery khi AppState active.
4. `src/shared/ui/__tests__/form-keyboard-avoider-ios.spec.tsx`: 3 tests PASS;
   iOS offset 0/80, padding trước animation dù RN snapshot false, không có
   AppState listener mới, và WizardScreen giữ measured-header offset 80.
   Log `/tmp/issue-660-ios-focused.log`. Các test sign-in layout/taps hiện có:
   19 tests PASS trong `/tmp/issue-660-ios.log` (lượt này shared iOS suite chưa
   chạy được do fixture import OneSignal; đã mock wizard-actions, chạy lại PASS).

## Quality gates

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0; 0 errors, 4 warnings cũ trong assistant-keyboard-offset/assistant-usage-footer |
| `pnpm test:ui --runInBand` | PASS, exit 0; 262 suites, 3.996 tests, 11 snapshots; 562,959 giây |
| `pnpm test` (Vitest) | Exit 1: 152 files PASS, 1 skipped; 1 file có 3 lỗi môi trường; 1.811 tests PASS, 39 skipped, 3 failed |

Ba lỗi Vitest nằm trong `src/shared/config/__tests__/distribute-wrapper.test.ts`:
`refuses while the owner is alive`, `refuses recovery while a recorded build
process group is still alive`, `keeps the lock and run files when a recorded
build group is still alive after the child exits`. Process probe xác nhận:

```text
ps: spawnSync ps EPERM; stdout undefined
pgrep: exit 3; sysmon request failed; Cannot get process list
```

Case đầu gọi `.stdout.trim()` nên lỗi vì stdout undefined; hai case sau dựa
vào `pgrep -g` trong script để phát hiện process group. Đây là lỗi môi trường
sandbox process-list, tách riêng với regression UI; không sửa hoặc skip test,
không claim full Vitest PASS. Log `/tmp/issue-660-process-probe.log`.
Logs quality gates: `/tmp/issue-660-{typecheck,lint,jest,vitest}.log`.
Full UI run dùng bản code/test cuối cùng, gồm cả 9 regression mới và regression
Android #400; tất cả PASS. Không có kết luận exact-head review/merge/acceptance
trong phiên DEV này.

## Device AC — PENDING (DEV đo emulator)

Chưa build/chạy emulator trong phiên này; Jest không chứng minh native
reachability hoặc pixel restoration. Mỗi dòng dưới đây cần DEV ghi build SHA,
AVD/API/density, navigation mode, locale/font scale và bằng chứng tọa độ.

| Màn hình | Keyboard mở | Keyboard đóng | Trạng thái |
| --- | --- | --- | --- |
| Đăng nhập (kèm Đăng ký dùng cùng view) | Focus password; field/CTA trên IME hoặc scroll tới được; tap CTA khi IME mở | So sánh với baseline của cùng state; không gap | PENDING |
| Quên mật khẩu | Focus email; CTA reachable | Về đúng baseline | PENDING |
| Đặt lại mật khẩu | Focus password/confirm; helpers/CTA reachable | Về đúng baseline | PENDING |
| Tham gia bằng mã | Focus code/name guest; CTA reachable | Về đúng baseline | PENDING |
| Wizard có avoidKeyboard (type/location) | Focus ô nhập; scroll/CTA reachable | Về đúng baseline | PENDING |

Lặp ít nhất hai chu kỳ show → Back/dismiss và background → active; kiểm tra
không còn gap sau layout tiếp theo. Đo iOS smoke riêng để xác nhận giữ layout
và offset. Không ghi AC accepted hoặc đóng issue từ kết quả unit test.

Rollback: thay wrapper ở năm view về KAV với behavior cũ và gỡ component/test
mới; không có thay đổi dữ liệu/contract cần rollback. Không thêm telemetry cho
keystroke/credentials; dựa vào regression và số đo layout để xác minh.
