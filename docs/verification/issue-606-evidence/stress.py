import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path.cwd()
out = Path('/tmp/gogo-606/stress')
out.mkdir(exist_ok=True)
spec = 'src/features/__tests__/notifications-g10.spec.tsx'
neighbors = ['src/shared/ui/__tests__/loading-indicator.spec.tsx', 'src/features/__tests__/home-location-scope.spec.tsx', 'src/shared/ui/__tests__/sheet.spec.tsx']
files = [spec, 'jest.setup.js', 'jest.config.js', 'pnpm-lock.yaml']
def hashes():
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in files}
basis = hashes()
results = []
def run(mode, number):
    label = f'{mode}-{number:02d}'
    cmd = ['pnpm', 'exec', 'jest', spec]
    cmd += ['--runInBand'] if mode == 'inband' else neighbors + ['--maxWorkers=4']
    cmd += ['--verbose=false', '--json', f'--outputFile={out / (label + ".json")}']
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    clock = time.monotonic()
    with (out / (label + '.log')).open('w') as log:
        process = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT)
    report_path = out / (label + '.json')
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    target = next((r for r in report.get('testResults', []) if r['name'].endswith(spec)), {})
    log_text = (out / (label + '.log')).read_text()
    result = dict(id=label, command=cmd, started_at=start, seconds=round(time.monotonic() - clock, 3), exit_code=process.returncode,
                  suites=report.get('numTotalTestSuites'), tests=report.get('numTotalTests'), failed_tests=report.get('numFailedTests'),
                  target_status=target.get('status'), target_tests=len(target.get('assertionResults', [])),
                  act_warning='not wrapped in act(' in log_text or 'act(...) warning(s)' in log_text,
                  log_sha256=hashlib.sha256(log_text.encode()).hexdigest())
    results.append(result)
    print(f'{label}: exit={process.returncode}, target={result["target_status"]}, tests={result["tests"]}, seconds={result["seconds"]}', flush=True)
    return result
def lane(mode, numbers):
    for number in numbers:
        run(mode, number)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(lane, 'inband', range(1, 31))]
    futures += [pool.submit(lane, 'workers', range(start, start + 10)) for start in (1, 11, 21)]
    for future in futures:
        future.result()
final_basis = hashes()
summary = dict(cwd=str(root), source_sha256=basis, source_unchanged=basis == final_basis, modes={'inband': 30, 'workers': 30},
               failures=sum(r['exit_code'] != 0 or r['target_status'] != 'passed' or r['act_warning'] for r in results),
               results=sorted(results, key=lambda r: r['id']))
(out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k != 'results'}), flush=True)
raise SystemExit(0 if summary['failures'] == 0 and summary['source_unchanged'] else 1)
