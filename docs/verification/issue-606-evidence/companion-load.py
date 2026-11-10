import datetime
import json
from pathlib import Path
import subprocess

out = Path('/tmp/gogo-606/stress')
results = []
while not (out / 'summary.json').exists():
    label = f'companion-{len(results) + 1:02d}'
    command = ['pnpm', 'exec', 'jest', 'src/shared/ui/__tests__/loading-indicator.spec.tsx', 'src/features/__tests__/home-location-scope.spec.tsx', 'src/shared/ui/__tests__/sheet.spec.tsx', '--maxWorkers=4', '--verbose=false', '--json', f'--outputFile={out / (label + ".json")}']
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (out / (label + '.log')).open('w') as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    results.append(dict(id=label, command=command, started_at=started, exit_code=process.returncode))
    print(f'{label}: exit={process.returncode}', flush=True)
(out / 'companion-summary.json').write_text(json.dumps(dict(results=results, failures=sum(r['exit_code'] != 0 for r in results)), indent=2) + '\n')
raise SystemExit(0 if all(r['exit_code'] == 0 for r in results) else 1)
