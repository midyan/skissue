# registry/

Resolve a skill id to a path inside the registry repository checkout.

## Contents

| Name                               | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| [catalog.test.ts](catalog.test.ts) | Vitest — list skill ids in a registry checkout     |
| [catalog.ts](catalog.ts)           | Enumerate ids from `registry.json` + `registry/`   |
| [resolve.test.ts](resolve.test.ts) | Vitest — `registry.json` and convention            |
| [resolve.ts](resolve.ts)           | Read `registry.json` or convention `registry/<id>` |
