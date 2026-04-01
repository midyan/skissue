# workflows/

GitHub Actions workflows for CI, version bumps, and npm publish.

## Contents

| Name                                               | Description                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [ci.yml](ci.yml)                                   | Verify on push and pull request                                                                                                    |
| [publish.yml](publish.yml)                         | Publish `skissue` to npm on `v*` tag push or workflow dispatch (`NPM_TOKEN`; use when re-running a failed publish)                 |
| [version-and-release.yml](version-and-release.yml) | On green `main`: bump version, GitHub release + tag, then npm publish (`NPM_TOKEN`; tag from Actions does not trigger publish.yml) |
