<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js
Python 3.12+ is also required for the ATA pipeline integration.

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` and `OPENAI_API_KEY` in [.env.local](.env.local) to your respective API keys
3. Run the app:
   `npm run dev`

## ATA Pipeline

Completed transcriptions can now trigger the ATA multiagent pipeline directly from the UI through the `Gerar ATA` action.

Requirements:
- Python installed locally
- `ata_multiagent_pipeline/` available in the workspace root
- SMTP configured in the pipeline `.env` if you want real email delivery

The generated artifacts are written to:
- `generated/ata_pipeline/atas/`
- `generated/ata_pipeline/sprints/`
- `generated/ata_pipeline/dashboards/`
- `generated/ata_pipeline/email/`
- `generated/ata_pipeline/logs/`
