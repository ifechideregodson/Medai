# MedAI Render Blueprint

This repository includes `render.yaml` for deploying the MedAI Clinical Platform on Render.

## Deploy

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and select the repository.
3. Render reads `render.yaml` and creates the web service and PostgreSQL database.
4. Enter the `sync: false` values in the Render dashboard.
5. Deploy.
6. Open `/api/health` and confirm the database reports `ok`.
7. Use the generated `FIRST_ADMIN_SETUP_SECRET` to create the first owner account through the existing first-admin setup route.

## Storage

The deployment supports both AWS S3-compatible storage and Cloudinary. Configure both provider sets of variables when both providers are available. The application storage layer uses S3 as the primary provider and Cloudinary as the redundant/fallback provider.

## Clinical safety

`AI_PROVIDER` is deliberately set to `disabled` in the Blueprint. Change it only when a real, validated model gateway is configured. Do not put patient data, database passwords, Cloudinary API secrets, S3 secrets, or model gateway secrets in GitHub.

## Database note

The Blueprint uses `prisma db push` during deployment because this project currently does not contain a Prisma migrations directory. Before a production clinical rollout, move to reviewed Prisma migrations and replace `db push` with `prisma migrate deploy`.

## External analyzer staging verification

Keep the external analyzer disabled until the following checks pass in a non-production staging environment:

1. Deploy the analyzer behind HTTPS and configure `MEDAI_WEB_API_KEY` there.
2. Configure the exact same high-entropy secret as Medai's server-side `MODEL_GATEWAY_API_KEY`. Never expose either value to browser code or commit it.
3. Set the model registry endpoint to the complete analyzer URL ending in `/api/v1/inference`.
4. Set the registered model version to `sha256:<64-character lowercase artifact digest>` for the exact deployed model artifact.
5. Upload a synthetic, non-patient JPEG, PNG, or WebP image through the normal Medai workflow. Confirm the analyzer response is stored as `NEEDS_REVIEW`, with model name/version and request hash recorded.
6. Verify missing/wrong credentials fail closed (401/503), a request hash mismatch is rejected, an inactive or mismatched model is rejected, and unsupported DICOM is rejected by this adapter.
7. Confirm no secret, signed storage URL, or patient image bytes appear in application logs, browser responses, or CI output.
8. Have an authorized clinician verify the review queue and explicitly complete the review workflow. The analyzer prediction itself must never mark a case clinically complete.

Use only synthetic data in this staging exercise. A successful smoke test proves connectivity and contract behavior, not clinical validity or diagnostic performance.
