"""Three fixed, separately released stages. No generic command, retry or hard-kill fallback."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time
import controller as c

INTERRUPTED = False


def hold(path, record):
    try:
        c.write_json(path, {**record, 'accepted': False, 'state': 'HOLD_OWNER_ALIVE'})
    except BaseException:
        pass
    try:
        os.write(2,b'HOLD: launcher owner alive; no retry or automatic hard termination.\n')
    except BaseException:
        pass
    while True:
        try:
            signal.pause()
        except BaseException:
            pass


def read_json(path):
    with path.open('rb') as stream:
        data = stream.read(1048577)
    if len(data) > 1048576: raise RuntimeError('evidence read bound')
    return json.loads(data)


def request_term(mechanism, identity, signal_errors):
    # Preserve returned errors separately from the initiating failure.
    signal_errors.extend(sorted(mechanism.signal_rows([identity], signal.SIGTERM, time.monotonic()+.25)))


def close_each(resources, finalization_errors):
    for name, resource in resources:
        if resource is not None:
            try:
                resource.close()
            except BaseException as caught:
                finalization_errors.append(name+':'+type(caught).__name__+':'+str(caught))


def no_launcher_errors(error, signal_errors, finalization_errors):
    return error is None and not signal_errors and not finalization_errors


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--stage',choices=['deterministic','normal','deadline'],required=True)
    parser.add_argument('--manifest-sha256',required=True)
    args=parser.parse_args()
    actual=hashlib.sha256((c.HERE/'manifest.json').read_bytes()).hexdigest()
    if actual != args.manifest_sha256: raise RuntimeError('reviewed manifest mismatch')
    c.verify()
    folder=c.ROOT/'.parity-boundary-controls'; folder.mkdir(exist_ok=True)
    prior={'normal':'deterministic','deadline':'normal'}.get(args.stage)
    if prior:
        gate=read_json(folder/(prior+'-gate.json'))
        if gate.get('accepted') is not True or gate.get('manifest_sha256') != actual:
            raise RuntimeError('previous stage missing/failed/stale')
    (folder/(args.stage+'-launcher.attempt')).open('x').close()
    mechanism=c.load_mechanism(); mechanism.prerequisite()
    signal.signal(signal.SIGCHLD,signal.SIG_DFL)
    def interrupted(*_):
        global INTERRUPTED
        INTERRUPTED=True
    for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP): signal.signal(sig,interrupted)
    run_id='control-'+args.stage+'-001'
    command=(['/usr/bin/python3',str(c.HERE/'deterministic_controls.py'),'--manifest-sha256',actual]
             if args.stage=='deterministic' else
             ['/usr/bin/python3',str(c.HERE/'controller.py'),'--released-run-id',run_id,'--manifest-sha256',actual])
    proc=None; identity=None; eof=False; total=0; error=None; outer=None
    signal_errors=[]; finalization_errors=[]
    selector=selectors.DefaultSelector()
    log=(folder/(args.stage+'-launcher.log')).open('xb',buffering=0)
    started=time.monotonic()
    try:
        if INTERRUPTED: raise RuntimeError('interrupted before spawn')
        proc=subprocess.Popen(command,cwd=c.ROOT,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,start_new_session=True,close_fds=True)
        identity=mechanism.identity(proc)
        os.set_blocking(proc.stdout.fileno(),False); selector.register(proc.stdout,selectors.EVENT_READ)
        deadline=started+(10 if args.stage=='deterministic' else 90)
        requested=None
        while True:
            status=os.waitid(os.P_PID,proc.pid,os.WEXITED|os.WNOHANG|os.WNOWAIT)
            if status is not None and eof: break
            if requested is None and (INTERRUPTED or time.monotonic() >= deadline or error):
                error=error or ('interrupted' if INTERRUPTED else 'launcher_wait_bound')
                requested=time.monotonic()
                request_term(mechanism,identity,signal_errors)
            if requested is not None and time.monotonic() >= requested+15:
                hold(folder/(args.stage+'-hold.json'),{'stage':args.stage,'pid':proc.pid,
                     'identity':identity,'error':error,'eof':eof,'bytes':total,'manifest_sha256':actual, 'signal_errors':signal_errors,
                     'finalization_errors':finalization_errors})
            for key,_ in selector.select(.05):
                data=os.read(key.fd,4096)
                if not data:
                    selector.unregister(key.fileobj); eof=True; continue
                keep=data[:max(0,65536-total)]
                written,whole=c.capture_write(log,keep); total+=written
                if not whole or len(keep)!=len(data) or total>=65536: error=error or 'launcher_capture_bound_or_short_write'
        # Child is waitable, still reserved. Reuse positive settlement, never Popen.poll/wait.
        outer=mechanism.settle(proc,identity,budget=12)
        if not outer['settled']:
            hold(folder/(args.stage+'-hold.json'),{'stage':args.stage,'pid':proc.pid,
                 'outer_settlement':outer,'error':error,'manifest_sha256':actual, 'signal_errors':signal_errors,
                     'finalization_errors':finalization_errors})
    except BaseException as caught:
        error=error or type(caught).__name__+':'+str(caught)
        if proc is not None and proc.returncode is None:
            # Unknown/live controller ownership: preserve this owner, do not kill it blindly.
            hold(folder/(args.stage+'-hold.json'),{'stage':args.stage,'pid':proc.pid,
                 'identity':identity,'error':error,'manifest_sha256':actual, 'signal_errors':signal_errors,
                     'finalization_errors':finalization_errors})
    finally:
        close_each([('selector',selector),('log',log),
                    ('stdout',proc.stdout if proc is not None else None)],finalization_errors)
    accepted=False; evidence=None
    try:
        c.verify()
        clean=(proc is not None and outer is not None and outer['settled'] and
               len(outer['reaped'])==1 and outer['reaped'][0]['pid']==proc.pid and
               eof and no_launcher_errors(error,signal_errors,finalization_errors) and not INTERRUPTED)
        if args.stage=='deterministic':
            evidence=read_json(folder/'deterministic.json')
            accepted=clean and proc.returncode==0 and evidence.get('accepted') is True and evidence.get('manifest_sha256')==actual
        else:
            output=c.ROOT/('.parity-boundary-'+run_id)
            evidence=read_json(output/'result.json')
            ready=read_json(output/'synthetic-ready.json')['processes']
            settlement=evidence['settlement']; obs=evidence['observation']
            snapshot=read_json(output/'snapshot.json')
            pids={row['pid'] for row in ready}
            statuses={row['pid']:row['exit'] for row in settlement['reaped']}
            rows={row['pid']:row for row in snapshot['rows']}
            common=(clean and settlement['settled'] and settlement['directReaped'] and settlement['noChildren'] and
                    settlement['complete'] and not settlement['errors'] and not settlement['residual'] and
                    not evidence['errors'] and not evidence['changed_sources'] and not snapshot['incomplete'] and
                    set(statuses)==pids and all(rows[row['pid']]['start']==row['start'] for row in ready))
            if args.stage=='normal':
                accepted=(common and proc.returncode==0 and evidence['candidate_completed'] is True and
                          evidence['reason']=='natural_exit' and len(ready)==1 and all(v==0 for v in statuses.values()) and
                          obs['capture_status']=='complete_eof' and obs['parsing_status']=='complete' and
                          obs['case_lifecycle']['all_expected_pairs_complete'] and evidence['p33_retention']['status']=='complete')
            else:
                expected={'p33_zero_evidence_files','p33_expected_one_fresh_attempt',
                          'p33_expected_one_nonce_for_attempt','p33_case_pair_not_complete'}
                accepted=(common and proc.returncode==1 and evidence['candidate_completed'] is False and
                          evidence['reason']=='wall_deadline' and len(ready)==2 and all(v==-9 for v in statuses.values()) and
                          obs['output_eof_observed'] is False and obs['capture_status']=='censored_prefix' and
                          obs['parsing_status']=='censored_prefix' and len(obs['outstanding_calls'])==1 and
                          obs['case_lifecycle']['entered']==1 and obs['case_lifecycle']['completed']==0 and
                          evidence['p33_retention']['status']=='incomplete' and set(evidence['p33_retention']['errors'])==expected)
    except BaseException as caught: error=error or type(caught).__name__+':'+str(caught)
    record={'stage':args.stage,'accepted':bool(accepted and no_launcher_errors(error,signal_errors,finalization_errors)),'manifest_sha256':actual,
            'actual_exit':proc.returncode if proc else None,'outer_settlement':outer,'error':error,
            'signal_errors':signal_errors,'finalization_errors':finalization_errors,
            'capture_eof':eof,'log_bytes':total,'elapsed_seconds':time.monotonic()-started,
            'evidence':evidence,'meaning':'Synthetic mechanism validation only; no parity/unzip execution.'}
    c.write_json(folder/(args.stage+'-gate.json'),record)
    print(json.dumps({'stage':args.stage,'accepted':record['accepted'],'actual_exit':record['actual_exit']}),flush=True)
    return 0 if record['accepted'] else 1


if __name__=='__main__': raise SystemExit(main())
