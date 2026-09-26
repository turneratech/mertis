# Contributing to Mertis

First off, thank you for considering contributing to Mertis! It's people like you that make Mertis such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps.**
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** if possible.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps.**
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most Mertis users.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the JavaScript/React styleguides
* Include screenshots and animated GIFs in your pull request whenever possible
* End all files with a newline
* Avoid platform-dependent code

## Development Setup

1. Fork the repo and create your branch from `main`.
2. Run `npm run install-all` to install dependencies.
3. Run `npm run dev` to start the development server.
4. Make your changes.
5. Run tests to make sure everything works.
6. Issue the pull request.

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### JavaScript Styleguide

* Use 2 spaces for indentation
* Use semicolons
* Use single quotes for strings
* Use template literals for string interpolation
* Use `const` for all of your references; avoid using `var`
* Use arrow functions over anonymous function expressions

### React Styleguide

* Use functional components with hooks
* Use meaningful component names
* Keep components small and focused
* Use PropTypes or TypeScript for type checking

## Project Structure

```
mertis/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.js        # Main app
│   │   └── styles.css    # Global styles
├── server/           # Node.js backend
│   ├── routes/       # API routes
│   ├── storage/      # Storage abstraction
│   └── index.js      # Server entry
└── docs/             # Documentation
```

## Questions?

Feel free to open an issue with your question or contact us at support@turneratech.com.

Thank you for contributing! 🎉

## Licensing and the DCO

Mertis is distributed under the **Business Source License 1.1** (see
[LICENSE](LICENSE) and [LICENSING.md](LICENSING.md)).

By contributing you certify that you wrote the patch or otherwise have the right
to submit it under that licence, and you agree that Turnera Tech Private Limited may
distribute your contribution under the BSL 1.1 and under the Change License
(Apache 2.0) once each version converts.

Sign off every commit with the [Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "SM-0001: short description"
```

`-s` appends a `Signed-off-by:` trailer. Commit subjects must also match CI
(`.github/workflows/validate-commits.yml`): `<BUG-ID>: <description>` plus an
`- Author: <name>` line somewhere in the message.
