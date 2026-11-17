const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

export const log = {
  title: (s) => console.log(`\n${C.bold}${C.magenta}▶ ${s}${C.reset}`),
  info:  (s) => console.log(`${C.cyan}ℹ${C.reset} ${s}`),
  ok:    (s) => console.log(`${C.green}✔${C.reset} ${s}`),
  warn:  (s) => console.log(`${C.yellow}⚠${C.reset} ${s}`),
  err:   (s) => console.log(`${C.red}✖${C.reset} ${s}`),
  skip:  (s) => console.log(`${C.dim}○ ${s}${C.reset}`),
};

export function summary(results) {
  const applied = results.filter((r) => r.status === 'applied').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed  = results.filter((r) => r.status === 'failed').length;
  log.title('Résumé');
  for (const r of results) {
    const icon = { applied: '✔', skipped: '○', failed: '✖' }[r.status];
    const color = { applied: C.green, skipped: C.dim, failed: C.red }[r.status];
    console.log(`  ${color}${icon}${C.reset} ${r.id.padEnd(35)} ${r.message ?? ''}`);
  }
  console.log(`\n${C.bold}Total${C.reset}: ${C.green}${applied} appliqués${C.reset}, ${C.dim}${skipped} ignorés${C.reset}, ${C.red}${failed} échoués${C.reset}\n`);
  if (failed > 0) process.exitCode = 1;
}
