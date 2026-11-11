"""Run 20 independent four-worker batches; retain every result, never retry.
Run from the repository root: python3 docs/verification/issue-606-evidence/followup/load.py
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import re
import signal
import subprocess
import threading
import time

root = Path.cwd()
out = Path('/tmp/gogo-606-followup/after')
out.mkdir(parents=True, exist_ok=False)
sources = sorted([*root.glob('src/**/*.ts'), *root.glob('src/**/*.tsx')])

def resolve(origin, name):
    base = root / 'src' / name[2:] if name.startswith('@/') else origin.parent / name
    for path in [base, Path(str(base) + '.ts'), Path(str(base) + '.tsx'), base / 'index.ts', base / 'index.tsx']:
        if path.is_file():
            return path.resolve()

graph = {}
for path in sources:
    names = re.findall(r"(?:from\s+|(?:require|import|jest\.requireActual)(?:<[^>]+>)?\()\s*['\"]([^'\"]+)", path.read_text())
    graph[path] = {target for name in names if name.startswith(('@/', '.')) and (target := resolve(path, name))}
list_sources = {p for p in sources if '__tests__' not in str(p) and re.search(r'<(?:FlatList|VirtualizedList|SectionList)\b', p.read_text())}
audit = []
specs = []
for path in sources:
    if not path.name.endswith('.spec.tsx'):
        continue
    seen = set()
    todo = [path]
    while todo:
        dependency = todo.pop()
        if dependency in seen:
            continue
        seen.add(dependency)
        todo.extend(graph.get(dependency, set()) - seen)
    lists = sorted(str(p.relative_to(root)) for p in seen & list_sources)
    helper = root / 'src/features/__tests__/scripted-time.ts' in seen
    if lists or helper:
        name = str(path.relative_to(root))
        specs.append(name)
        audit.append(dict(spec=name, shared_clock=helper, reachable_lists=lists))
(out / 'list-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
basis_files = sources + [root / p for p in ['jest.setup.js', 'jest.config.js', 'pnpm-lock.yaml', 'package.json']]
def hashes():
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in basis_files}
basis = hashes()
(out / 'source-before.json').write_text(json.dumps(basis, indent=2) + '\n')
results = []
stop = threading.Event()
signal.signal(signal.SIGINT, lambda *_: stop.set())

def run(number):
    label = f'load-{number:02d}'
    command = ['pnpm', 'test:ui', '--runTestsByPath', *specs, '--maxWorkers=4', '--json', '--outputFile=' + str(out / (label + '.json'))]
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    clock = time.monotonic()
    with (out / (label + '.log')).open('w') as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    report_path = out / (label + '.json')
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    log = (out / (label + '.log')).read_text()
    warning = bool(re.search(r'not wrapped in act\(|overlapping act\(\) calls|not configured to support act\(|act\(\.\.\.\) warning\(s\)', log))
    row = dict(id=label, command=command, started_at=start, ended_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               seconds=round(time.monotonic() - clock, 3), exit_code=process.returncode,
               suites=report.get('numTotalTestSuites'), tests=report.get('numTotalTests'), failed_tests=report.get('numFailedTests'), act_warning=warning,
               specs={str(Path(s['name']).relative_to(root)): dict(status=s['status'], tests=len(s['assertionResults'])) for s in report.get('testResults', [])},
               log_sha256=hashlib.sha256(log.encode()).hexdigest())
    results.append(row)
    (out / (label + '-result.json')).write_text(json.dumps(row, indent=2) + '\n')
    print(f'{label}: exit={process.returncode}, suites={row["suites"]}, tests={row["tests"]}, act_warning={warning}, seconds={row["seconds"]}', flush=True)
    if process.returncode != 0 or warning or set(row['specs']) != set(specs) or any(s['status'] != 'passed' for s in row['specs'].values()):
        stop.set()

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    # Start each pair together so even the final run has a companion batch.
    for offset in range(10):
        if stop.is_set():
            break
        futures = [pool.submit(run, start + offset) for start in (1, 11)]
        for future in futures:
            future.result()
failures = sum(r['exit_code'] != 0 or r['act_warning'] or set(r['specs']) != set(specs) or any(s['status'] != 'passed' for s in r['specs'].values()) for r in results)
for result in results:
    result['overlapping_batches'] = [other['id'] for other in results if other['id'] != result['id'] and other['started_at'] < result['ended_at'] and other['ended_at'] > result['started_at']]
summary = dict(cwd=str(root), source_sha256=basis, source_unchanged=basis == hashes(), requested_repetitions=20, completed_repetitions=len(results), max_workers_per_batch=4, concurrent_lanes=2,
               specs=specs, failures=failures, results=sorted(results, key=lambda r: r['id']))
(out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k not in ('source_sha256', 'specs', 'results')}), flush=True)
raise SystemExit(0 if failures == 0 and len(results) == 20 and summary['source_unchanged'] else 1)
