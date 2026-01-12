<!--
  Copyright (c) 2026 Mike Odnis

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
-->

# 🚀 n8n AI Content Bot - Quick Start

**Goal**: Transform raw text into structured Sanity CMS documents in seconds using AI.

## ⚡ 3-Minute Setup

### 1. Get API Keys

**OpenAI** (recommended):

```
https://platform.openai.com/api-keys
```

**Sanity Token** (Editor permissions):

```
https://manage.sanity.io → Your Project → API → Tokens
```

### 2. Configure Environment

Add to your `.env`:

```bash
OPENAI_API_KEY=sk-proj-xxxxx
SANITY_API_TOKEN=skxxxxx
NEXT_PUBLIC_SANITY_PROJECT_ID=xxxxx
NEXT_PUBLIC_SANITY_DATASET=production
```

### 3. Start n8n

```bash
./scripts/start-n8n.sh
```

Or manually:

```bash
docker-compose up -d n8n
```

### 4. Import Workflow

1. Open `http://localhost:5678`
2. Create account (local)
3. **Workflows** → **Import from File**
4. Select: `n8n_workflows/sanity-content-bot.json`
5. Click any **AI Prompt** node → **Credentials** → Add OpenAI key
6. **Save**

## 🎯 Usage

### Add Work Experience

1. Open workflow
2. Click **"Set Input Data"** node
3. Set `contentType` to `Experience`
4. Paste job description in `rawText`:

   ```
   Senior Full-Stack Engineer at Vercel
   San Francisco, CA
   March 2023 - Present

   Leading Next.js App Router development. Built new React Server
   Components architecture. Mentored 5 engineers on modern patterns.

   Tech: Next.js, React, TypeScript, Rust, Postgres
   ```

5. Click **Execute Workflow** ▶️
6. Check Sanity Studio!

### Add Project

Change `contentType` to `Project`:

```
Portfolio Website v3

Modern portfolio with Next.js 15, real-time Spotify/Discord
integration, AI blog. Deployed on Vercel with Docker.

Live: https://mikeodnis.dev
GitHub: https://github.com/yourname/portfolio

Stack: Next.js, TypeScript, Elysia, Sanity, TanStack Query
Status: Completed
Featured: Yes
```

### Add Certification

Change `contentType` to `Certification`:

```
AWS Solutions Architect - Professional

Issued by: Amazon Web Services
Date: September 15, 2024
Credential: AWS-CSA-PRO-123456
Verify: https://aws.amazon.com/verify/...

Advanced AWS architecture, multi-tier systems, disaster recovery.

Skills: AWS, Cloud Architecture, Lambda, VPC, RDS, Security
```

## 📊 What Gets Created

The AI automatically:

- ✅ Extracts dates and converts to YYYY-MM-DD
- ✅ Parses technologies into arrays
- ✅ Identifies URLs (company websites, GitHub, etc.)
- ✅ Generates slugs for projects
- ✅ Sets sensible defaults (order: 0, featured: false)
- ✅ Infers categories from technologies
- ✅ Creates properly typed Sanity documents

## 🔍 Troubleshooting

| Problem                   | Solution                                            |
| ------------------------- | --------------------------------------------------- |
| "Authentication failed"   | Check `SANITY_API_TOKEN` has **Editor** permissions |
| AI returns text, not JSON | Enable `responseFormat: json_object` in AI node     |
| Missing required fields   | Add more detail to your raw text                    |
| Rate limit error          | Add 300ms delay or switch to Anthropic              |

## 🎨 Advanced Tips

### Batch Processing

Edit `rawText` to include multiple items (AI will intelligently separate them):

```
Experience 1: Senior Engineer at Vercel, 2023-Present, React/Next.js

Experience 2: Software Engineer at Meta, 2021-2023, React Native
```

### Custom Schemas

Duplicate an AI Prompt node and adjust the schema in the system prompt for your own content types.

### Web Scraping

Add an **HTTP Request** node before input to fetch LinkedIn/GitHub pages automatically.

## 📖 Full Documentation

**Complete guide**: [`docs/N8N_SETUP_GUIDE.md`](../docs/N8N_SETUP_GUIDE.md)

## 💡 Pro Tips

1. **Be explicit with dates**: "January 2023" > "early 2023"
2. **List all technologies**: The AI extracts these perfectly
3. **Include URLs**: Company sites, GitHub, live demos
4. **Add context**: The more detail, the better the structure
5. **Review in Sanity**: Always check before publishing

---

**Time saved per entry**: ~5 minutes  
**Accuracy**: ~95% (minor tweaks needed)  
**Best use case**: Bulk importing work history, projects, certifications

🤖 **Happy automating!**
