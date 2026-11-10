# GoGo-MobileApp #606 — VirtualizedList CI act flakes

## Nguyên nhân và bằng chứng trước sửa

Gắn tạm `new Error().stack` vào nhánh bắt act warning của `console.error`
trong `jest.setup.js`, giữ nguyên việc in cảnh báo và fail test của #133.
Chạy 8 lượt Jest, 4 tiến trình đồng thời, mỗi tiến trình `--maxWorkers=4`,
với notifications-g10 + loading-indicator + home-location-scope + sheet.
3/8 lượt fail, tổng cộng 4 test fail do guard #133:

- `opening marks unread once and preserves the existing resolver` (3 lượt).
- `orange inbox error regression › shows one stale notice for cached list + summary failures (0 rows)` (1 lượt).

Stack thu được:

```text
console.error (jest.setup.js, instrumentation tạm)
warnIfUpdatesNotWrappedWithActDEV
scheduleUpdateOnFiber
enqueueSetState
VirtualizedList.setState
VirtualizedList._updateCellsToRender (VirtualizedList.js:1907)
Timeout._onTimeout (VirtualizedList.js:1804)
listOnTimeout → processTimers
```

`VirtualizedList` lên lịch cập nhật cell bằng `setTimeout`, mặc định 50 ms
(`updateCellsBatchingPeriod`). Phần lớn spec dùng real timers; chỉ nhóm
`full notification fixture` có fake timers riêng. Khi máy bận, callback batch
có thể tới hạn giữa các thao tác RNTL hoặc lúc RNTL xả microtask trước cleanup,
ngoài `act`. Test nhận cảnh báo phụ thuộc thời điểm callback chạy.
Stack ghi nhận là timer nội bộ của list; không phải refetch hay logo animation.

Log gốc của lượt fail: [before-load-failure.log](issue-606-evidence/before-load-failure.log).
Tổng hợp đủ 8 lượt và phiên bản môi trường: [before-summary.json](issue-606-evidence/before-summary.json).

## Sửa

`src/features/__tests__/notifications-g10.spec.tsx`:

- Bật fake timers ở `beforeEach` chung, giữ nguyên FlatList/VirtualizedList thật.
- Teardown gọi `await cleanup()` trước, xả timer còn lại bên trong `await act(...)`,
  rồi trả về real timers trong `finally`.
- Bỏ hook timer cục bộ của full fixture để mọi test có cùng vòng đời timer.

Không thêm retry hay lọc cảnh báo. Instrumentation tạm đã được gỡ;
`jest.setup.js` so sánh byte-for-byte khớp bản trước điều tra.
Không thay đổi code production, API hoặc dependency.

## Kiểm chứng sau sửa — local, 2026-11-10

Môi trường: Node v22.22.2, pnpm 10.34.3, Jest 29.7.0, macOS.

| Chế độ | Lượt chạy | Test/lượt | Kết quả |
| --- | ---: | ---: | --- |
| `notifications-g10.spec.tsx --runInBand`, vòng lặp tuần tự | 30 | 193 | 30 PASS, 0 fail |
| Notifications + loading-indicator + home-location-scope + sheet, `--maxWorkers=4` | 30 | 249 | 30 PASS, 0 fail |

Nhánh worker chia thành 3 tiến trình chạy đồng thời, mỗi tiến trình 10 lượt.
Nhánh in-band chạy 30 lượt liên tiếp. Các suite lân cận tiếp tục chạy nền bằng
`--maxWorkers=4` đến khi nhánh in-band xong: thêm 40 batch, 0 fail.
Đối chiếu timestamp xác nhận cả 30 lượt in-band đều có tải Jest khác chạy đồng thời.
Mỗi lượt là một lần gọi Jest mới, không retry; mọi kết quả đều được giữ lại.

Tổng cộng spec đích chạy 60 lần × 193 = **11.580 test executions**, 0 fail,
0 act warning. Hai nhóm chính có tổng 13.260 test executions.
Source SHA-256 trước/sau stress khớp cho spec, guard, Jest config và lockfile.

- [Manifest từng lượt, lệnh, timestamp, exit code, số test và source SHA-256](issue-606-evidence/summary.json).
- [Manifest tải nền](issue-606-evidence/companion-summary.json).
- [Toàn bộ log sau sửa, gồm focused test/typecheck/lint](issue-606-evidence/after-logs.tar.gz).
- Script đã dùng: [stress.py](issue-606-evidence/stress.py), [companion-load.py](issue-606-evidence/companion-load.py).
  Hai script chạy từ root repo; script stress chạy trước, companion chạy đồng thời
  khi stress còn hoạt động. Output gốc: `/tmp/gogo-606/stress/`.
- `pnpm exec jest src/features/__tests__/notifications-g10.spec.tsx --runInBand`: 193/193 PASS.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm exec eslint src/features/__tests__/notifications-g10.spec.tsx`: exit 0, không warning.

Đây là bằng chứng local, chưa xác nhận một CI run mới. Không chạy git.

Source basis:

```text
58f8ecfa24ac511957b9a40b26cf03f8bfd035380456480bb8a66c60de31016e  src/features/__tests__/notifications-g10.spec.tsx
7dde8de94fe6ee2bde8026202572e04be5b22d350aa0a328423b2e6af07f2611  jest.setup.js
57fced514b47817b78358e5358775144f3d58d355e7f2777efb4a07d0d537f47  jest.config.js
fac06497e9ffc0300a9e1c7b3621a05a26d66e4b50f94fb19b8a5f0b1cd0fe07  pnpm-lock.yaml
```

## Follow-up — dùng chung vòng đời timer, 2026-11-10

Trong checkout này, spec loading-list nằm ở
`src/features/__tests__/loading-list.spec.tsx` (không có bản ở `src/shared/ui`).
Các kết quả ở phần trên là bằng chứng lịch sử của bản sửa notifications ban đầu;
follow-up này có source basis và log riêng.

### Điều tra và phạm vi

- Một full run `--maxWorkers=4` trước sửa PASS 234 suites / 3.444 tests.
  Khi chạy đồng thời hai full suite và hai nhánh batch, loading-list FAIL
  **5/8 batch**, mỗi lần guard #133 bắt act warning. Stack đều đi qua
  `VirtualizedList._updateCellsToRender` → `Timeout._onTimeout` (batch 50 ms).
  Hai full suite đồng thời vẫn PASS; một full run đơn lẻ không đủ chứng minh hết flake.
- `assistant-conversation.spec.tsx` đã lấy fake timers qua `assistant-harness.tsx`
  → `scriptedTime()`. Không tái hiện được warning của spec này trong đợt baseline;
  vẫn kiểm chứng lại toàn bộ spec bằng vòng stress cuối.
- Tìm cả `FlatList`, `VirtualizedList`, `SectionList`, rồi lần theo import của
  các spec, kể cả helper và `.cases.tsx`: **42 spec ứng viên**. Đây là tập bao phủ
  bảo thủ; có import bị mock hoặc nhánh không mount list trong một số test.
- Đợt stress mở rộng phát hiện thêm cùng stack list ở
  `assistant-redesign-matrix.spec.tsx` và `sheet-surfaces.spec.tsx`.
  `prefill-location.spec.tsx` cũng phát cảnh báo #133 từ callback đóng `Sheet`
  (`setExiting`); spec này đi qua flow administrative picker. Cả ba dùng cùng
  helper timer sau sửa. Đợt thăm dò đã dừng để sửa; các lượt bị ngắt không được
  tính là PASS hay gộp vào bằng chứng 20 lượt cuối.

### Thay đổi

- Mở rộng helper có sẵn `src/features/__tests__/scripted-time.ts`:
  bật fake timers trước mỗi test; teardown `await cleanup()` trước, chạy
  `jest.runOnlyPendingTimers()` trong `await act(...)`, rồi clear phần timer
  được callback lên lịch tiếp và trả real timers trong `finally`.
- Notifications bỏ hook timer trùng lặp và gọi `scriptedTime()`.
  Loading-list, assistant-redesign-matrix, sheet-surfaces và prefill-location
  dùng cùng helper. Assistant conversation nhận teardown mới qua harness;
  sửa comment cũ nói nhầm là đang dùng real time.
- Giữ nguyên list thật, assertions, timeout và guard #133. Không thêm retry.
  `jest.setup.js`, `jest.config.js`, lockfile và code production không đổi.

### Gate trên bản sửa cuối

- `pnpm test:ui --runInBand`: **234 suites, 3.444 tests, 11 snapshots PASS**;
  không act warning; source SHA-256 trước/sau khớp.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0, không warning.
- Focused check cả sáu spec chạm tới: **328/328 tests PASS**.

Full in-band cuối chạy riêng trước vòng stress. Một lần chạy in-band trước đó
đã bị ngắt sau timeout 5 giây ở button-sizing khi chạy đồng thời với 16 worker
stress; log lỗi đó được giữ lại. Không sửa timeout hoặc assertion để vượt gate.

Manifest điều tra và mọi lượt fail/ngắt:
[investigation-summary.json](issue-606-evidence/followup/investigation-summary.json).
Gate và source basis:
[gates.json](issue-606-evidence/followup/gates.json).

### Stress cuối — PASS 20/20, 0 failure, 0 act warning

Chạy **20 lần gọi Jest độc lập**, mỗi lần cả tập 42 spec với
`--maxWorkers=4`. Hai batch bắt đầu cùng nhau theo từng cặp; timestamp xác nhận
mọi lượt, kể cả cặp cuối, đều có batch khác chạy đồng thời. Không retry.
Mỗi batch PASS 42 suites / 828 tests. Tổng: **840 spec executions,
16.560 test executions**, 0 failure, 0 act warning, không worker-exit warning.
Tập này bao gồm cả **22 spec dùng helper chung** sau sửa.

| Spec chạm tới | Test/lượt | Lượt PASS dưới tải | Failure / act warning |
| --- | ---: | ---: | ---: |
| notifications-g10 | 193 | 20/20 | 0 / 0 |
| loading-list | 4 | 20/20 | 0 / 0 |
| assistant-conversation | 11 | 20/20 | 0 / 0 |
| assistant-redesign-matrix | 46 | 20/20 | 0 / 0 |
| sheet-surfaces | 64 | 20/20 | 0 / 0 |
| prefill-location | 10 | 20/20 | 0 / 0 |

Source SHA-256 của toàn bộ `.ts`/`.tsx` dưới `src`, `package.json`, Jest setup/config
và lockfile khớp trước/sau stress, đồng thời khớp basis của full in-band PASS.
Guard #133 vẫn có SHA-256
`7dde8de94fe6ee2bde8026202572e04be5b22d350aa0a328423b2e6af07f2611`.

- [Manifest 20 lượt: lệnh, timestamp, exit code, từng spec và batch chạy đồng thời](issue-606-evidence/followup/load-summary.json).
- [Audit 42 spec và các list/helper đi tới qua import](issue-606-evidence/followup/list-audit.json).
- [Script stress](issue-606-evidence/followup/load.py): chạy từ root repo bằng
  `python3 docs/verification/issue-606-evidence/followup/load.py`.
  Script tạo `/tmp/gogo-606-followup/after` mới, dừng nếu có lỗi và không ghi đè
  kết quả cũ; chuyển thư mục output cũ sang tên khác trước một campaign mới.
- [Toàn bộ log và Jest JSON report, kể cả fail/ngắt trước sửa, source gốc và patch](issue-606-evidence/followup/logs.tar.gz).
- [SHA-256 các artifact](issue-606-evidence/followup/artifacts-sha256.json).

Môi trường như phần đầu: Node v22.22.2, pnpm 10.34.3, Jest 29.7.0, macOS.
Đây là kết quả local; chưa xác nhận CI run mới. Không chạy git.
