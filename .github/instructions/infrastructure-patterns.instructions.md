---
applyTo: "docker-compose*.yml,deploy.sh,rollback.sh,nginx.conf,prod.sh"
---

# Infrastructure & Deployment Patterns

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## Rollback Safety

The deploy pipeline (`deploy.sh`) runs on the VPS after `git reset --hard origin/master`, meaning the VPS always has the **latest** versions of all infrastructure files. If a deployment fails, `deploy.sh` rolls back by:

1. Restoring the database from a pre-deploy backup
2. Pulling the **previous** Docker images (`PREV_APP_TAG`)
3. Starting services with those old images using the **current** (new) compose files

**⚠️ Critical edge case**: Because the rollback uses the **new** compose files with the **old** Docker images, any breaking change to infrastructure files can make rollback impossible.

### What counts as a breaking change?

- Renaming or removing a service in `docker-compose.yml` or `docker-compose.prod.yml`
- Changing volume mounts that old images depend on
- Changing environment variable names that old images expect
- Changing port mappings in a way that old images can't handle
- Modifying `nginx.conf` in a way that's incompatible with old container behavior

### How to safely make infrastructure changes

1. **Make infrastructure changes backward-compatible** — old images should still work with new compose files
2. **If a breaking change is unavoidable**, split it into two deployments:
   - **Deploy 1**: Ship new images that support both old and new infrastructure config
   - **Deploy 2**: Update the infrastructure files (compose, nginx, etc.)
3. **Test rollback manually** after deploying infrastructure changes:
   ```bash
   # On the VPS, verify the previous tag still works
   APP_TAG=<previous-tag> docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### CI Warning

The deploy workflow (`deploy.yml`) automatically detects when infrastructure files are modified in a commit and prints a warning during the deploy job. This is a reminder to verify rollback compatibility before approving the deployment.
