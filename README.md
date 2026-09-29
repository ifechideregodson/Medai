# MedAI Clinical Platform — Clinical Core

No demo patients, fake diagnoses, or fabricated clinical results are included.

Added: organizations/memberships, consent records, clinical reports, model registry, research jobs, health endpoint, consent/model-gating services, reports and model-registry UI.

Production database: PostgreSQL. Run `npx prisma generate`, then `npx prisma migrate deploy`.

Clinical AI is blocked until an active validated model endpoint is registered. No diagnostic conclusion is fabricated.


## High-availability clinical storage

Clinical assets use redundant private storage. S3-compatible storage is attempted first and Cloudinary is maintained as a secondary private/authenticated copy when both providers are configured. If S3 is unavailable, reads automatically fall back to Cloudinary for assets that have a Cloudinary copy. If S3 is unavailable during a new upload, the upload can continue through Cloudinary.

Configure both provider sets in the deployment environment:

- S3: `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SERVER_SIDE_ENCRYPTION`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

Cloudinary assets are uploaded as `authenticated`, not public assets. Keep `CLOUDINARY_API_SECRET` server-side only.

## Owner / Super-Admin Control Center

The `/admin` area is restricted to users with the `SUPER_ADMIN` role. It provides real controls for users, roles, organization memberships, organizations, platform statistics, audit counts, and AWS S3/Cloudinary storage health. User changes are recorded in the existing audit chain.

The storage dashboard checks both providers. The application continues to use S3 as the preferred provider and Cloudinary as the fallback/secondary provider.

## Owner / Super-Admin controls (V12 build layer)

The `/admin` area is restricted to `SUPER_ADMIN` and now provides operational controls for users, organization activation, organization membership, model activation/retirement, read-only patient oversight, storage health, protected asset repair, and recent audit activity.

### Redundant storage

S3 remains the preferred provider and Cloudinary is the protected secondary provider. New assets are dual-written when both providers are available. Reads fall back to Cloudinary when S3 retrieval fails. The owner dashboard includes a repair action to restore a missing provider copy from an available protected copy.

Cloudinary credentials must remain server-side. Authenticated Cloudinary assets require signed delivery URLs; do not expose `CLOUDINARY_API_SECRET` to the browser.
