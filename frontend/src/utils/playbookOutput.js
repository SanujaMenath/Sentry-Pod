const mocha = {
  base: "#1e1e2e",
  mantle: "#181825",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  lavender: "#b4befe",
  blue: "#89b4fa",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  peach: "#fab387",
  sapphire: "#74c7ec",
  sky: "#89dceb",
};

export const classifyLine = (line) => {
  if (!line.trim()) return { color: mocha.subtext1 };
  if (line.startsWith("PLAY RECAP")) return { color: mocha.lavender, weight: 700 };
  if (line.startsWith("PLAY [")) return { color: mocha.blue, weight: 700 };
  if (line.startsWith("TASK [")) return { color: mocha.sapphire, weight: 700 };
  if (line.startsWith("ok:")) return { color: mocha.green };
  if (line.startsWith("changed:")) return { color: mocha.yellow };
  if (line.startsWith("failed:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("skipped:")) return { color: mocha.peach };
  if (line.startsWith("fatal:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("[")) return { color: mocha.subtext1 };
  return { color: mocha.text };
};
