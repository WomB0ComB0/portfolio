# n8n Workflows

This directory contains n8n workflow definitions for automating content creation in your Sanity CMS.

## Available Workflows

### 🤖 `sanity-content-bot.json`

**AI-Powered Content Structuring**

Automatically converts unstructured text into properly formatted Sanity documents using GPT-4.

**Supported Content Types:**

- ✅ Experience (work history)
- ✅ Projects
- ✅ Certifications

**How to use:**

1. Import this workflow into n8n
2. Edit the "Set Input Data" node
3. Paste your raw text
4. Click "Execute Workflow"
5. Check Sanity Studio for the new document

## Quick Start

```bash
# Start n8n
./scripts/start-n8n.sh

# Or manually with docker-compose
docker-compose up -d n8n

# Access n8n
open http://localhost:5678
```

## Import Workflows

1. Open n8n at `http://localhost:5678`
2. Click **Workflows** → **Import from File**
3. Select `sanity-content-bot.json`
4. Configure your OpenAI API credentials
5. Ready to use!

## Creating New Workflows

When you create new workflows in n8n:

1. **Export** them from n8n (Settings → Download)
2. **Save** to this directory
3. **Commit** to version control
4. **Document** in this README

## Documentation

Full setup guide: [`docs/N8N_SETUP_GUIDE.md`](../docs/N8N_SETUP_GUIDE.md)

## Workflow Schema

Each workflow JSON file contains:

- Node definitions (triggers, AI models, API calls)
- Connection mappings
- Credential references
- Settings and metadata

These files are portable and can be shared across n8n instances.
