# Trae Preflight

This folder is prepared for `wangxt-834-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18134
- API_PORT: 19134
- WEB_PORT: 20134
- DB_PORT: 21134
- REDIS_PORT: 22134

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
