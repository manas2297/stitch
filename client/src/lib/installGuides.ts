/** Homebrew install + PATH setup snippets for runtimes the Profile screen reports missing. */
export const INSTALL_GUIDES: Record<string, { cmd: string; path: string }> = {
  go: {
    cmd: "brew install go",
    path: 'export PATH="/opt/homebrew/opt/go/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  node: {
    cmd: "brew install node",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  npm: {
    cmd: "brew install node # npm is bundled with Node.js",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  python: {
    cmd: "brew install python",
    path: 'export PATH="/opt/homebrew/opt/python/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  postgres: {
    cmd: "brew install postgresql@14\nbrew services start postgresql@14",
    path: 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  mongo: {
    cmd: "brew tap mongodb/brew\nbrew install mongodb-community@6.0\nbrew services start mongodb-community@6.0",
    path: 'export PATH="/opt/homebrew/opt/mongodb-community@6.0/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  redis: {
    cmd: "brew install redis\nbrew services start redis",
    path: 'export PATH="/opt/homebrew/opt/redis/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  docker: {
    cmd: "brew install --cask docker",
    path: '# Docker Desktop is installed as a GUI app — no PATH changes needed.\n# Launch Docker.app from Applications after install.',
  },
  brew: {
    cmd: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
    path: 'export PATH="/opt/homebrew/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  bun: {
    cmd: "curl -fsSL https://bun.sh/install | bash",
    path: 'export BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  rust: {
    cmd: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
    path: 'export PATH="$HOME/.cargo/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
};
