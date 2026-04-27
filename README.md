# 📈 Portfolio.Ai

**Portfolio.Ai** is a premium, AI-powered investment portfolio system designed to give you deep insights into your financial assets. Built with a modern tech stack and a stunning 3D-animated interface, it combines real-time asset tracking with intelligent risk analysis and AI-driven assistance.

![Portfolio Dashboard Mockup](https://raw.githubusercontent.com/lucide-react/lucide/main/icons/trending-up.svg)

## ✨ Features

- **🚀 Real-time Dashboard**: A comprehensive overview of your net worth, portfolio performance, and asset distribution.
- **🤖 AI Portfolio Assistant**: Personalized insights and strategy recommendations powered by advanced AI.
- **📊 Advanced Risk Analysis**: Deep dive into your portfolio's volatility, sector exposure, and risk metrics.
- **💹 Smart Trading Simulation**: Seamless buy/sell interface with real-time price tracking.
- **📋 Asset Management**: Manage holdings, watchlists, and transaction history in one place.
- **🔐 Secure OAuth Integration**: Support for Google Sign-in and custom OAuth portals.
- **🎨 Premium UI/UX**: Built with Framer Motion animations, 3D landing pages, and a responsive glassmorphism design.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS (v4), Framer Motion, Radix UI.
- **Backend**: Node.js, Express, tRPC (Type-safe API).
- **Database**: MySQL with Drizzle ORM.
- **Cloud/Infrastructure**: AWS S3 (Storage), Google OAuth.
- **Development Tools**: TypeScript, Vitest, Esbuild.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v10+)
- [MySQL](https://www.mysql.com/) database instance.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/investment-portfolio-system.git
   cd investment-portfolio-system
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
   *Required variables: `DATABASE_URL`, `JWT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.*

4. **Initialize the database**:
   ```bash
   npm run db:push
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

### 📦 Build & Production

- **Build Project**: `npm run build`
- **Start Production Server**: `npm run start`

---

## 🔒 Security Note

This repository uses a `.gitignore` to protect sensitive environment variables (`.env`) and OAuth secrets. **Never** remove these files from the ignore list.

## 📄 License

This project is licensed under the MIT License.
