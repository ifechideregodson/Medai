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
