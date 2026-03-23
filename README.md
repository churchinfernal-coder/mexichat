# Mexivanza Travel Booking Platform

## Project info

**URL**: https://lovable.dev/projects/18546bf7-caf9-4ba0-8fff-7e82f52195d4

## Local Development Setup (Windows/PowerShell/VS Code Compatible)

This project is fully compatible with Windows, PowerShell, and VS Code. No Linux-specific commands required.

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/download/win)
- **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

### Quick Start (PowerShell/CMD)

```powershell
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd mexivanza-travel

# Step 3: Install dependencies
npm install

# Step 4: Start the development server
npm run dev
```

The app will run at `http://localhost:8080`

### Supabase Configuration

This project uses an **external Supabase project** (already configured). The credentials are hardcoded in:
- `src/integrations/supabase/client.ts`

**Project ID**: `cchakgecusfybcokbmau`

No additional Supabase CLI setup is required for local development. The app connects directly to the hosted Supabase instance.

### VS Code Recommended Extensions

Install these for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "supabase.supabase-vscode"
  ]
}
```

### Available Scripts

```powershell
npm run dev          # Start development server (port 8080)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Development Workflow

**Option 1: Use Lovable (Recommended)**

Visit the [Lovable Project](https://lovable.dev/projects/18546bf7-caf9-4ba0-8fff-7e82f52195d4) and make changes via AI prompts. Changes auto-commit to GitHub.

**Option 2: Local Development**

1. Make changes in VS Code
2. Test locally with `npm run dev`
3. Commit and push to GitHub
4. Changes sync automatically to Lovable

### Troubleshooting (Windows/PowerShell)

**Port already in use:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Node/npm not recognized:**
- Restart PowerShell/VS Code after installing Node.js
- Verify installation: `node --version` and `npm --version`

**Git not recognized:**
- Add Git to PATH: `C:\Program Files\Git\cmd`
- Restart PowerShell/VS Code

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/18546bf7-caf9-4ba0-8fff-7e82f52195d4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
