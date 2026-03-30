---
applyTo: "backend/requirements.txt"
---

# Backend Requirements Rules

These instructions apply only when adding new packages to `backend/requirements.txt`.

- Do not update, replace, or re-pin preexisting packages unless the user explicitly asks for that change or a concrete dependency/runtime constraint requires it.
- Do not upgrade existing packages just because a newer version exists.
- For each newly added package, prefer the latest stable release unless there is a specific reason not to.
- Before adding a new package version, check the latest stable version with:
  - `python3 -m pip index versions <package>`
- Use the package name as understood by pip. For extras like `channels[daphne]`, check `channels`. For `django-anymail[resend]`, check `django-anymail`.
- If you do not use the latest stable version for a newly added package, state the specific reason in the response.

Valid reasons to avoid the latest stable version include:
- Python version incompatibility
- Django, Channels, Celery, or other ecosystem compatibility constraints already present in this repository
- Breaking major-version changes that would require coordinated code changes outside the requested task
- Known regression, security, or operational concerns
- Another package being added or already pinned in this repository constrains the version

Invalid reasons include:
- "it doesn't matter"
- "close enough"
- "not worth updating"
- "keeping consistency" without a concrete compatibility constraint
