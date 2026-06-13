export const COLOR_SCHEMES = {
  catppuccin: {
    name: "Catppuccin",
    defaultFlavor: "mocha",
    flavors: {
      mocha: {
        name: "Mocha",
        background: "#1e1e2e", foreground: "#cdd6f4", cursor: "#f5e0dc",
        selectionBackground: "#585b70", black: "#45475a", red: "#f38ba8",
        green: "#a6e3a1", yellow: "#f9e2af", blue: "#89b4fa",
        magenta: "#f5c2e7", cyan: "#94e2d5", white: "#bac2de",
        brightBlack: "#585b70", brightRed: "#f38ba8", brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af", brightBlue: "#89b4fa", brightMagenta: "#f5c2e7",
        brightCyan: "#94e2d5", brightWhite: "#a6adc8",
      },
      macchiato: {
        name: "Macchiato",
        background: "#24273a", foreground: "#cad3f5", cursor: "#f4dbd6",
        selectionBackground: "#5b6078", black: "#494d64", red: "#ed8796",
        green: "#a6da95", yellow: "#eed49f", blue: "#8aadf4",
        magenta: "#f5bde6", cyan: "#8bd5ca", white: "#b8c0e0",
        brightBlack: "#5b6078", brightRed: "#ed8796", brightGreen: "#a6da95",
        brightYellow: "#eed49f", brightBlue: "#8aadf4", brightMagenta: "#f5bde6",
        brightCyan: "#8bd5ca", brightWhite: "#a5adcb",
      },
      frappe: {
        name: "Frappe",
        background: "#303446", foreground: "#c6d0f5", cursor: "#f2d5cf",
        selectionBackground: "#626880", black: "#51576d", red: "#e78284",
        green: "#a6d189", yellow: "#e5c890", blue: "#8caaee",
        magenta: "#f4b8e4", cyan: "#81c8be", white: "#b5bfe2",
        brightBlack: "#626880", brightRed: "#e78284", brightGreen: "#a6d189",
        brightYellow: "#e5c890", brightBlue: "#8caaee", brightMagenta: "#f4b8e4",
        brightCyan: "#81c8be", brightWhite: "#a5adce",
      },
      latte: {
        name: "Latte",
        background: "#eff1f5", foreground: "#4c4f69", cursor: "#dc8a78",
        selectionBackground: "#acb0be", black: "#5c5f77", red: "#d20f39",
        green: "#40a02b", yellow: "#df8e1d", blue: "#1e66f5",
        magenta: "#ea76cb", cyan: "#179299", white: "#acb0be",
        brightBlack: "#6c6f85", brightRed: "#d20f39", brightGreen: "#40a02b",
        brightYellow: "#df8e1d", brightBlue: "#1e66f5", brightMagenta: "#ea76cb",
        brightCyan: "#179299", brightWhite: "#7287fd",
      },
    },
  },
  everforest: {
    name: "Everforest",
    defaultFlavor: "dark",
    flavors: {
      dark: {
        name: "Dark",
        background: "#2d353b", foreground: "#d3c6aa", cursor: "#d3c6aa",
        selectionBackground: "#5a6a7a", black: "#475258", red: "#e67e80",
        green: "#a7c080", yellow: "#dbbc7f", blue: "#7fbbb3",
        magenta: "#d699b6", cyan: "#83c092", white: "#d3c6aa",
        brightBlack: "#5a6a7a", brightRed: "#e67e80", brightGreen: "#a7c080",
        brightYellow: "#dbbc7f", brightBlue: "#7fbbb3", brightMagenta: "#d699b6",
        brightCyan: "#83c092", brightWhite: "#e1d4c0",
      },
      light: {
        name: "Light",
        background: "#fdf6e3", foreground: "#5c6a72", cursor: "#5c6a72",
        selectionBackground: "#d3c6aa", black: "#5c6a72", red: "#e67e80",
        green: "#a7c080", yellow: "#dbbc7f", blue: "#7fbbb3",
        magenta: "#d699b6", cyan: "#83c092", white: "#e1d4c0",
        brightBlack: "#9da9a0", brightRed: "#e67e80", brightGreen: "#a7c080",
        brightYellow: "#dbbc7f", brightBlue: "#7fbbb3", brightMagenta: "#d699b6",
        brightCyan: "#83c092", brightWhite: "#fdf6e3",
      },
    },
  },
  gruvbox: {
    name: "Gruvbox",
    defaultFlavor: "dark",
    flavors: {
      dark: {
        name: "Dark",
        background: "#282828", foreground: "#ebdbb2", cursor: "#ebdbb2",
        selectionBackground: "#504945", black: "#282828", red: "#cc241d",
        green: "#98971a", yellow: "#d79921", blue: "#458588",
        magenta: "#b16286", cyan: "#689d6a", white: "#a89984",
        brightBlack: "#928374", brightRed: "#fb4934", brightGreen: "#b8bb26",
        brightYellow: "#fabd2f", brightBlue: "#83a598", brightMagenta: "#d3869b",
        brightCyan: "#8ec07c", brightWhite: "#ebdbb2",
      },
      light: {
        name: "Light",
        background: "#fbf1c7", foreground: "#3c3836", cursor: "#3c3836",
        selectionBackground: "#d5c4a1", black: "#3c3836", red: "#cc241d",
        green: "#98971a", yellow: "#d79921", blue: "#458588",
        magenta: "#b16286", cyan: "#689d6a", white: "#a89984",
        brightBlack: "#928374", brightRed: "#fb4934", brightGreen: "#b8bb26",
        brightYellow: "#fabd2f", brightBlue: "#83a598", brightMagenta: "#d3869b",
        brightCyan: "#8ec07c", brightWhite: "#fbf1c7",
      },
    },
  },
  "tokyo-night": {
    name: "Tokyo Night",
    defaultFlavor: "storm",
    flavors: {
      storm: {
        name: "Storm",
        background: "#24283b", foreground: "#a9b1d6", cursor: "#c0caf5",
        selectionBackground: "#364a82", black: "#414868", red: "#f7768e",
        green: "#73daca", yellow: "#e0af68", blue: "#7aa2f7",
        magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
        brightBlack: "#414868", brightRed: "#f7768e", brightGreen: "#73daca",
        brightYellow: "#e0af68", brightBlue: "#7aa2f7", brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff", brightWhite: "#c0caf5",
      },
      night: {
        name: "Night",
        background: "#1a1b26", foreground: "#a9b1d6", cursor: "#c0caf5",
        selectionBackground: "#364a82", black: "#414868", red: "#f7768e",
        green: "#73daca", yellow: "#e0af68", blue: "#7aa2f7",
        magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
        brightBlack: "#414868", brightRed: "#f7768e", brightGreen: "#73daca",
        brightYellow: "#e0af68", brightBlue: "#7aa2f7", brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff", brightWhite: "#c0caf5",
      },
      light: {
        name: "Light",
        background: "#d5d6db", foreground: "#343b58", cursor: "#343b58",
        selectionBackground: "#a1a6c5", black: "#343b58", red: "#8c4351",
        green: "#485e30", yellow: "#965027", blue: "#34548a",
        magenta: "#5a4a78", cyan: "#0f4b6e", white: "#9699a3",
        brightBlack: "#5a5e78", brightRed: "#8c4351", brightGreen: "#485e30",
        brightYellow: "#965027", brightBlue: "#34548a", brightMagenta: "#5a4a78",
        brightCyan: "#0f4b6e", brightWhite: "#c0caf5",
      },
    },
  },
  nord: {
    name: "Nord",
    theme: {
      background: "#2e3440", foreground: "#d8dee9", cursor: "#88c0d0",
      selectionBackground: "#434c5e", black: "#3b4252", red: "#bf616a",
      green: "#a3be8c", yellow: "#ebcb8b", blue: "#81a1c1",
      magenta: "#b48ead", cyan: "#88c0d0", white: "#e5e9f0",
      brightBlack: "#4c566a", brightRed: "#bf616a", brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b", brightBlue: "#81a1c1", brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb", brightWhite: "#eceff4",
    },
  },
  dracula: {
    name: "Dracula",
    theme: {
      background: "#282a36", foreground: "#f8f8f2", cursor: "#f8f8f2",
      selectionBackground: "#44475a", black: "#21222c", red: "#ff5555",
      green: "#50fa7b", yellow: "#f1fa8c", blue: "#bd93f9",
      magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
      brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94",
      brightYellow: "#ffffa5", brightBlue: "#d6acff", brightMagenta: "#ff92df",
      brightCyan: "#a4ffff", brightWhite: "#ffffff",
    },
  },
};

export function resolveTheme(colorScheme) {
  const parts = colorScheme.split("-");
  const schemeKey = parts[0];
  const flavorKey = parts.slice(1).join("-") || null;
  const entry = COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.catppuccin;
  if (entry.flavors) {
    const flavor = flavorKey && entry.flavors[flavorKey]
      ? entry.flavors[flavorKey]
      : entry.flavors[entry.defaultFlavor];
    return { schemeKey, flavorKey: flavorKey || entry.defaultFlavor, flavorName: flavor.name, theme: flavor };
  }
  return { schemeKey, flavorKey: null, flavorName: null, theme: entry.theme };
}

export function getSwatchColors(colorScheme) {
  const { theme } = resolveTheme(colorScheme);
  return [theme.red, theme.green, theme.yellow, theme.blue];
}

export const DEFAULT_TERMINAL_CONFIG = {
  ssh: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace",
    colorScheme: "catppuccin-mocha",
    cursorStyle: "block",
    cursorBlink: true,
  },
  console: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace",
    colorScheme: "catppuccin-mocha",
    cursorStyle: "block",
    cursorBlink: true,
  },
};

export const FONT_FAMILIES = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace" },
  { label: "Fira Code", value: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Courier New', monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace" },
  { label: "Monaspace Neon", value: "'Monaspace Neon', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace" },
  { label: "Monospace", value: "monospace" },
];

export const CURSOR_STYLES = [
  { label: "Block", value: "block" },
  { label: "Underline", value: "underline" },
  { label: "Bar", value: "bar" },
];
