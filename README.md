# Web App Template

A full-stack web application template using Next.js 16, SST v3, and AWS. Each developer gets their own isolated cloud environment. Production deploys automatically on push to `main`.

**Stack:** Next.js 16 · CloudFront + S3 · Cognito (Entra ID SSO) · DynamoDB · API via Route Handlers · Tailwind CSS

---

## Prerequisites

### 1. Homebrew (macOS only)

[Homebrew](https://brew.sh) is the package manager used in the macOS install steps below. Skip this if you're on Linux or Windows.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts — it will also install the Xcode Command Line Tools if needed.

### 2. Node.js

Install Node.js 20 or later. We recommend [nvm](https://github.com/nvm-sh/nvm) to manage versions.

**macOS / Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
# restart your terminal, then:
nvm install 20
nvm use 20
```

**Windows:** Use [nvm-windows](https://github.com/coreybutler/nvm-windows) or download the installer from [nodejs.org](https://nodejs.org).

Verify:
```bash
node --version   # should print v20.x.x or higher
npm --version
```

### 3. AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install
```

**Windows:** Download the [AWS CLI MSI installer](https://awscli.amazonaws.com/AWSCLIV2.msi).

Verify:
```bash
aws --version
```

### 4. AWS credentials

You need an AWS account and credentials with permission to create CloudFormation stacks, Lambda functions, S3 buckets, CloudFront distributions, and DynamoDB tables.

**Option A — IAM user (simplest for personal dev accounts):**

1. In the [AWS Console](https://console.aws.amazon.com/iam), create an IAM user with `AdministratorAccess` (or a scoped policy covering the services above).
2. Create an access key under **Security credentials → Access keys**.
3. Run:

```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region name:   us-east-1
# Default output format: json
```

**Option B — AWS SSO (recommended for team accounts):**

```bash
aws configure sso
# Follow the prompts to authenticate via your identity provider.
# Profile name: default  (or any name — pass it via AWS_PROFILE if not default)
```

Verify your credentials work:
```bash
aws sts get-caller-identity
# should print your account ID and user/role ARN
```

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd web-app-template
npm install
```

### 2. Copy the environment files

```bash
cp .env.example .env
cp app/.env.example app/.env
```

`app/.env` contains browser-visible config. It is **not** for secrets. Open it and verify `NEXT_PUBLIC_COGNITO_DOMAIN` is correct for your environment (the default is pre-filled).

### 3. Start your personal dev stack

Pick a stage name — by convention use your first name or username:

```bash
npx sst dev --stage alice
```

On first run this takes about 3 minutes to provision your personal AWS resources (Cognito app client, CloudFront distribution, DynamoDB table). Subsequent starts are fast.

When ready you'll see:

```
✓  Complete
   App:     web-app
   Stage:   alice
```

Open **http://localhost:3000** in your browser.

> **Note:** The `url` shown in SST output is unavailable in dev mode — always use `http://localhost:3000` locally.

### 4. Sign in

The app uses Entra ID SSO via the Cognito hosted UI. Click **Go to Dashboard** and you will be redirected to sign in.

---

## Secrets

Secret values (API keys, webhook secrets, etc.) are stored encrypted in AWS SSM Parameter Store — they are **never** committed to the repository or stored in `.env` files.

Set a secret for your personal stage:
```bash
npx sst secret set MySecretKey "the-value" --stage alice
```

Set a secret for production:
```bash
npx sst secret set MySecretKey "the-value" --stage production
```

See [CLAUDE.md](./CLAUDE.md) for the full secrets workflow including how to declare, link, and access secrets in Route Handlers.

---

## Deploying to production

Production deploys run automatically via GitHub Actions when you push to `main`. Before the first production deploy you need to:

1. **Set up an IAM role for GitHub Actions** with permission to deploy. Add the role ARN as a repository secret named `AWS_DEPLOY_ROLE_ARN`. The workflow uses OIDC — no long-lived credentials needed. See the [GitHub OIDC guide](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) for setup.

2. **Set any required secrets for production:**
```bash
npx sst secret set MySecretKey "prod-value" --stage production
```

3. **Push to main.** The Actions workflow will run `sst deploy --stage production`.

To deploy manually:
```bash
npx sst deploy --stage production
```

---

## Tearing down a personal stack

When you're done with your dev stage, remove it to avoid ongoing AWS costs:

```bash
npx sst remove --stage alice
```

This deletes all resources in your stage. The production stage is protected and cannot be removed this way.

---

## Project structure

```
infra/          Infrastructure definitions (SST/Pulumi TypeScript)
app/            Next.js 16 application
  app/api/      Route Handlers (backend endpoints)
  app/(pages)/  Frontend pages
  lib/          Shared utilities (auth helpers, API client)
packages/       Additional Lambda functions (auth triggers, background jobs)
```

For a full description of every file and how to extend the app (add endpoints, pages, DynamoDB access patterns, secrets), see [CLAUDE.md](./CLAUDE.md).

---

## Common commands

| Command | Description |
|---|---|
| `npx sst dev --stage <name>` | Start local dev |
| `npx sst deploy --stage <name>` | Deploy a stage to AWS |
| `npx sst remove --stage <name>` | Tear down a stage |
| `npx sst secret set <Key> <val> --stage <name>` | Set a secret |
| `npx sst secret list --stage <name>` | List secrets for a stage |
| `npx sst console` | Open SST console (logs, DynamoDB viewer) |
| `npm run typecheck` | Run TypeScript checks across all packages |
