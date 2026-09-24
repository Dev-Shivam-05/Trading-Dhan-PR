/**
 * P36 row 3 (sleep-proof-v1.md) — keep this PC awake while the paper trader needs it.
 *
 * Measured 2026-09-24: the laptop entered Modern Standby at 10:40:04 and woke at 17:45:35, and the
 * paper trader priced every exit off a 10:40 tick. Windows' own answer is
 * `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)`: it blocks idle sleep for as long
 * as the calling thread lives. Node has no binding for it, so one child `powershell` makes the call
 * and then sleeps. Killing the child releases the hold. `powercfg /requests` lists it under SYSTEM.
 *
 * It does not stop a lid close or the power button — only idle sleep.
 */

import { spawn, type ChildProcess } from 'node:child_process';

let child: ChildProcess | null = null;

// The child also watches this process: if the server is killed by PID (the routine in CLAUDE.md),
// an orphan would otherwise hold the machine awake until someone found it.
const script = (parentPid: number) => [
  `$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'`,
  `Add-Type -Name Power -Namespace Dhan -MemberDefinition $sig`,
  `[Dhan.Power]::SetThreadExecutionState([uint32]'0x80000001') | Out-Null`,
  `while (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 30 }`,
].join('; ');

export function keepAwake(hold: boolean, log: (msg: string) => void = console.log): void {
  if (process.platform !== 'win32') return;
  if (hold && !child) {
    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script(process.pid)], {
      stdio: 'ignore', windowsHide: true,
    });
    c.on('exit', () => { if (child === c) child = null; });
    c.on('error', e => { log(`[awake] could not hold the PC awake: ${e.message}`); if (child === c) child = null; });
    child = c;
    log(`[awake] holding the PC awake (child PID ${c.pid})`);
  } else if (!hold && child) {
    child.kill();
    child = null;
    log('[awake] released');
  }
}

process.on('exit', () => { child?.kill(); });
