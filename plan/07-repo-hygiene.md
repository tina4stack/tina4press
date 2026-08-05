# Task 07: Repo hygiene and release

## Goal

Make the repo honest about what it is, and make a release repeatable.

## Scope

- [x] Rewrite the README against the code. It claimed "Status: MVP" and listed the
      home hero layout and tabbed code-group as not implemented; both shipped. It
      documented none of `sidebarGroups`, `sectionLabels`, `colors`, `analytics`,
      `chat`, `head`, `outDir` or `cleanUrls`.
- [x] Document the known limitations honestly, with workarounds
- [x] Add the Code Infinity sponsor block and copyright, matching the family format
- [x] Add a LICENSE file. MIT was claimed in package.json and the README with no
      LICENSE file present.
- [x] Proper `plan/` folder on the Tina4 pattern: MASTER plus one plan per task
- [ ] `npm test` wired in package.json, and `prepublishOnly` gating publish on green
- [ ] Delete the committed `tina4press-0.1.0.tgz` build artefact
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md documenting the publish path, including the
      `gh auth switch --user tina4stack` step, so it is not rediscovered each release
- [ ] Update the README limitations section once task 01's fixes are released
- [ ] Consider making the repo public - it is already published publicly to npm

## Release methodology

Per the Tina4 release rule: cut `feature/release<version>` from `main`, bank the
work, merge back, verify green independently at that HEAD, then tag. The tag is
what publishes; merging alone does not.

**Publishing gotcha, recorded so it is not rediscovered:** `git push` to
tina4stack/tina4press fails for `andrevanzuydam` over BOTH https and ssh. Push as
the owner:

```
gh auth switch --user tina4stack
git -c credential.helper='!gh auth git-credential' push
gh auth switch --user andrevanzuydam
```

npm publish needs a Classic **Automation** token on the `tina4stack` account.
Passkey, OTP and granular-publish tokens all hit EOTP/403.

When tina4press releases, `tina4-documentation` must bump its dependency and update
**both** `package-lock.json` and `pnpm-lock.yaml` - `packageManager` is pnpm but the
Jenkins deploy runs `npm install`, so a stale pnpm lock breaks a pnpm build.

## Bugs

- [ ] `tina4press-0.1.0.tgz` is committed to the repo

## Commits

- (pending) docs: rewrite README against the code, add limitations, sponsor, LICENSE
- (pending) plan: proper plan folder on the Tina4 pattern

## Status: In Progress
