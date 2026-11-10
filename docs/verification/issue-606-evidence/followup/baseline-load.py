import concurrent.futures, subprocess, json, time
from pathlib import Path
out=Path('/tmp/gogo-606-followup')
specs=['src/features/__tests__/'+s+'.spec.tsx' for s in ['loading-list','assistant-conversation','notifications-detail','notifications-push-notice','my-contributions-reviews','my-contributions-reviews-dark','my-contributions-snapshot']]
def run(label,full=False):
 cmd=['pnpm','test:ui']+([] if full else specs)+['--maxWorkers=4','--json','--outputFile='+str(out/(label+'.json'))]
 start=time.time()
 with (out/(label+'.log')).open('w') as f: r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
 report=json.loads((out/(label+'.json')).read_text())
 row=dict(id=label,command=cmd,started_at=start,ended_at=time.time(),exit_code=r.returncode,failed_tests=report['numFailedTests'])
 print(json.dumps(row),flush=True)
 return row
def lane(n): return [run(f'before-batch-{n}-{i}') for i in range(1,5)]
with concurrent.futures.ThreadPoolExecutor(4) as pool:
 fs=[pool.submit(run,'before-full-'+str(i),True) for i in [1,2]]+[pool.submit(lane,i) for i in [1,2]]
 results=[f.result() for f in fs]
(out/'baseline-load-summary.json').write_text(json.dumps(results,indent=2)+'\n')
