import { execFileSync } from 'node:child_process';

export function readEntry(archive: string, entry: string): string {
  return execFileSync('unzip', ['-p', archive, entry], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function listEntries(archive: string): string[] {
  return execFileSync('unzip', ['-Z1', archive], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
