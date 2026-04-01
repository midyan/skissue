# harness/

This directory holds **hard** TypeScript checks for the **skissue** CLI repository (`harness/<check-id>/hard/index.ts`). They run via **`harness/runner.ts`** (`npm run check:all`).

The **hosted skill catalog** (full soft docs and installable payloads) lives in the separate **skill-registry** repository (`registry.json` + `registry/<skill-id>/` there).
