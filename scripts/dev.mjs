import { spawn } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  spawn(npm, ['run','dev','-w','server'], { stdio:'inherit', env:process.env }),
  spawn(npm, ['run','dev','-w','client'], { stdio:'inherit', env:process.env })
];
let closing = false;
const close = () => { if(closing) return; closing=true; commands.forEach(p=>p.kill()); };
process.on('SIGINT',close);
process.on('SIGTERM',close);
commands.forEach(p => p.on('exit', (code) => { if(!closing && code !== null && code!==0) { close(); process.exitCode=code; } }));
