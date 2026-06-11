# Chapter 14 — Shipping It: CI, Deploy & Automated Updates

> **Previous:** [Chapter 13 — SEO & the Semantic Web](13-seo.md) | **Next:** —

---

You can build a site locally — but how does it get *tested* on every change, go *live* automatically, and stay *up to date* without someone remembering to do it? That's **CI/CD** (continuous integration / continuous deployment), and it's run by **GitHub Actions**: small YAML workflows that GitHub executes for you on events like "a pull request opened" or "main was pushed." The `flipjump-docs` repo has three, and together they're a tidy tour of how real projects ship.

---

## The build is a test

Chapter 11 was about tests you write. But the docs build is *itself* a test — remember `-W` from Chapter 12 turns any warning (a broken link, a page missing from the nav) into a failure. The pull-request workflow runs exactly that, plus the Python unit tests:

```yaml
# .github/workflows/pr-build.yml
- name: Build Sphinx site (-W via Makefile default)
  run: cd docs && make html
- name: Run pytest
  run: pytest tests/ -v
```

If a PR breaks a cross-link, `make html` exits non-zero and GitHub marks the PR red — the bad link can't reach the live site.

---

## More gates

The same PR workflow runs other checks before anything merges:

```yaml
# .github/workflows/pr-build.yml
jobs:
  actionlint:      # lint the workflow YAML itself
  grammar:         # verify the syntax-highlighting grammar is in sync
  build-and-test:  # make html (-W) + pytest
```

`actionlint` is a nice touch — it lints the CI files themselves, catching workflow mistakes the same way ESLint catches code mistakes (Chapter 11). Each job runs independently; **all** must pass.

---

## Deploying: build, then copy

When code lands on `main`, a second workflow builds the site and ships the static files to the server over SSH:

```yaml
# .github/workflows/deploy.yml
- name: Build Sphinx site
  run: cd docs && make html
- name: Deploy to fjdocs.tomhe.app via rsync
  uses: burnett01/rsync-deployments@66257cad6bfeb2171d3b6bfa6c9a22279dd9c3a1
  with:
    remote_host: ${{ secrets.SSH_HOST }}
    remote_user: ${{ secrets.SSH_USER }}
    remote_key: ${{ secrets.PRIVATE_SSH_KEY }}
```

Two things to notice. **`${{ secrets.* }}`** pulls credentials from GitHub's encrypted secret store, so the SSH key never appears in the repo (the same instinct as the `.env` values from Chapter 10). And the action is pinned to a full **commit hash**, not a tag like `@v1` — a tag can be moved to point at malicious code later, but a hash can't, which protects against supply-chain attacks.

---

## Keeping dependencies fresh automatically

The docs render the FlipJump standard library from its real source. To stay current, the repo pins that source as a **git submodule** — another repo nested inside this one at a fixed commit:

```ini
# .gitmodules
[submodule "vendor/flip-jump"]
	path = vendor/flip-jump
	url = https://github.com/tomhea/flipjump.git
	branch = main
```

A third workflow is a **scheduled bot**. On a weekly timer it bumps that submodule to the latest upstream commit and, if anything changed, opens a pull request:

```yaml
# .github/workflows/submodule-bump.yml
on:
  schedule:
    - cron: "0 9 * * 1"   # Mondays 09:00 UTC
```

The PR then runs the same checks from the top of this chapter, so a human only has to glance at it and merge. (Tools like Dependabot and Renovate automate dependency updates the same way.) One subtlety the workflow documents: a PR opened by the bot's default token deliberately *won't* trigger other workflows, a GitHub safeguard against workflows endlessly triggering each other.

---

## Key takeaways

- **CI/CD** runs in GitHub Actions — YAML workflows triggered by events like opening a PR or pushing to `main`.
- The docs build **is a test**: `make html -W` fails on broken links, so it gates every PR alongside `pytest` and `actionlint`.
- **Deploy** = build the static site, then `rsync` it to the server over SSH; credentials come from encrypted **secrets**, and third-party actions are **pinned to a commit hash** for supply-chain safety.
- Upstream source is pinned as a **git submodule** so the build is reproducible.
- A **scheduled bot** bumps that submodule weekly and opens a PR, keeping dependencies current with human review but no manual work.

---

> **Back to index:** [tutorial/README.md](README.md)
