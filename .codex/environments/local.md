# Local Codex Environment

Run Codex in WSL2/Ubuntu. Keep the repository inside the Linux filesystem, for example:

```bash
~/code/castivo
```

Required tools:

- Node.js 24 LTS
- pnpm 11 via Corepack
- Git
- GitHub CLI
- Docker Desktop with WSL integration
- Supabase CLI pinned as dev dependency
- FFmpeg and ffprobe
- Playwright browsers

Local services:

```text
Control:   http://localhost:3000
Player:    http://localhost:3001
Marketing: http://localhost:3002
Supabase:  http://127.0.0.1:54321
Studio:    http://127.0.0.1:54323
```

Never connect local Codex to production Supabase or production credentials.
