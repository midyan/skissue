import chalk from "chalk";

const LOGO = [
  "  ▗▄▄▖▗▖ ▗▖▗▄▄▄▖▗▖   ▗▖   ",
  "  ▐▌   ▐▌▗▞▘  █  ▐▌   ▐▌   ",
  "  ▝▀▚▖ ▐▛▚▖   █  ▐▌   ▐▌   ",
  "  ▗▄▄▞▘▐▌ ▐▌▗▄█▄▖▐▙▄▄▖▐▙▄▄▖",
  "  ▗▄▄▄▖▗▄▄▖▗▄▄▖▗▖ ▗▖▗▄▄▄▖  ",
  "    █  ▐▌   ▐▌   ▐▌ ▐▌▐▌    ",
  "    █   ▝▀▚▖ ▝▀▚▖▐▌ ▐▌▐▛▀▀▘ ",
  "  ▗▄█▄▖▗▄▄▞▘▗▄▄▞▘▝▚▄▞▘▐▙▄▄▖ ",
];

const GRADIENT_STOPS: [number, number, number][] = [
  [99, 102, 241],
  [139, 92, 246],
  [192, 132, 252],
  [233, 213, 255],
  [192, 132, 252],
  [139, 92, 246],
  [99, 102, 241],
  [79, 70, 229],
];

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function gradientLine(line: string, row: number, totalRows: number): string {
  const stopIdx = (row / Math.max(1, totalRows - 1)) * (GRADIENT_STOPS.length - 1);
  const lo = Math.floor(stopIdx);
  const hi = Math.min(lo + 1, GRADIENT_STOPS.length - 1);
  const t = stopIdx - lo;
  const [r, g, b] = lerpColor(GRADIENT_STOPS[lo]!, GRADIENT_STOPS[hi]!, t);
  return chalk.rgb(r, g, b)(line);
}

export function printSkillIssueBanner(version?: string): void {
  console.log("");
  for (let i = 0; i < LOGO.length; i++) {
    console.log(gradientLine(LOGO[i]!, i, LOGO.length));
  }
  if (version) {
    console.log(chalk.dim(`  v${version}`));
  }
  console.log("");
}
