# Introduction
First off, thank you for considering contributing to fj.tomhe.app — the online IDE for [FlipJump](https://esolangs.org/wiki/FlipJump). It's people like you that make the esoteric language community such a great, active and evolving community.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

This is an open source project, and we love to receive contributions from our community — you!   
There are many ways to contribute, from writing tutorials or blog posts, writing new fj-programs, improving the documentation, submitting bug reports and feature requests or writing code which can be incorporated into the IDE itself.

Also, please take 2 minutes to show this project to the people you know that would **see the magic in this language.**

Please, don't use the issue tracker for support-questions. Instead, use the [Questions thread](https://github.com/tomhea/flipjump/discussions/176), or the [Discussions](https://github.com/tomhea/flipjump/discussions) in general. 

## Responsibilities
 * Keep the dev server working on every major platform contributors use — Windows, Ubuntu & macOS — and keep the IDE working across the browsers the E2E suite covers (Chromium, Firefox & WebKit).
 * Ensure that code that goes into core passes the CI (`npm test`, `npm run lint`, `npm run typecheck`).
 * Create issues (+Discussions) for any major changes and enhancements that you wish to make. Discuss things transparently and get community feedback.
 * Keep each PR as small as possible, preferably one new change/feature per PR.
 * Be welcoming to newcomers and encourage diverse new contributors from all backgrounds. See the [Python Community Code of Conduct](https://www.python.org/psf/codeofconduct/).

## Your First Contribution
Unsure where to begin contributing? You can start by creating and running your own FlipJump programs in the IDE, on your own repos, and spread the rumor :)  
Also, please take a look at the [Contribution thread](https://github.com/tomhea/flipjump/discussions/148).

Working on your first Pull Request? You can learn how from this free series, [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

At this point, you're ready to make your changes! Feel free to ask for help; everyone is a beginner at first 😸

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch, so it's easier to merge.

# Getting started
1. Create your own fork of the code
2. Do the changes in your fork (keep them minimal).
3. If you like the changes and think the project could use it:
    * Be sure you have followed the [code style](CONTRIBUTING.md#clean-code) for the project.
    * Be sure your project passes the CI — run `npm test`, `npm run lint`, and `npm run typecheck` (see the [Tests](README.md#tests) section).
    * Send a pull request.

If you have **small or "obvious" fixes**, include SMALLFIX in the PR/issue name.
such fixes can be:
* Spelling / grammar fixes
* Typo correction, white space and formatting changes
* Comment clean up
* Functions/Classes rearrangements in the same file
It should still pass the CI.

# How to report a bug
When filing an issue, make sure to answer these five questions:

 1. What version of fj.tomhe.app are you using (if no version, make sure you fetched the last changes, and specify the branch name)?
 2. What operating system and browser are you using?
 3. What did you do?
 4. What did you expect to see?
 5. What did you see instead?
General questions should go to the [Questions thread](https://github.com/tomhea/flipjump/discussions/176), or the [Discussions](https://github.com/tomhea/flipjump/discussions) in general. 

# How to suggest a feature or enhancement
The FlipJump philosophy is to be the simplest language of all, that can do any modern computation.

FlipJump should be below the OS, as it's a cpu-architecture after all.

This IDE aims to make writing, compiling, and running FlipJump programs in the browser as frictionless as possible, while staying lightweight and dependency-light.

If you find yourself wishing for a feature that doesn't exist, you are probably not alone. Some features that exist today have been added because our users saw the need. Open an issue on our issues list on GitHub which describes the feature you would like to see, why you need it, and how it should work.

## Code review process
After feedback has been given to the Pull Request, we expect responses within two weeks. After two weeks we may close the pull request if it isn't showing any activity.

# Community
You can chat with the core team and the community on [GitHub Discussions](https://github.com/tomhea/flipjump/discussions).

# Clean Code
Get familiar with [Clean Code](https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29) (mainly the functions/names sections).

In short:
- use **clear names** (full words, **descriptive**, not-too-long), for variables, functions, and classes (nouns).
- **functions should do exactly one thing**. no side effects. They should be **very short** (and call other descriptive functions). IT IS POSSIBLE for a function to be 4-5 lines (and we should aim to that). 

Keep in mind that the developers of this community invested much of their time in making this project as clean, simple, and documented as they can. 

If you find a piece of code that isn't compliant with this standard, it probably has an open issue and is known, and if not, please open a new issue.  

Follow this rule but don't try to be perfect, and use the [80/20](https://en.wikipedia.org/wiki/Pareto_principle) principle. Yet, make an effort to make the code as simple, as much as you'd expect from others in this project's community.
