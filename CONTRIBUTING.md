# Contributing to Stitch

Thank you for showing interest in contributing to Stitch!

We want to make contributing to this project as easy and transparent as possible, whether it's:
- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

---

## 🎃 Hacktoberfest

Stitch is participating in **Hacktoberfest**! We welcome contributions from everyone during October.

### How to participate

1. **Find an issue** — Look for issues labelled [`good first issue`](../../issues?q=is%3Aopen+label%3A%22good+first+issue%22) or [`hacktoberfest`](../../issues?q=is%3Aopen+label%3Ahacktoberfest).
2. **Comment to claim** — Leave a comment on the issue saying you'd like to work on it. A maintainer will assign it to you.
3. **Open a PR** — Submit your pull request within a reasonable time. Include `Closes #<issue-number>` in the PR description.
4. **Get it merged** — Once reviewed and approved, your PR will be merged and will count toward Hacktoberfest.

### Quality guidelines (spam prevention)

To keep the experience positive for everyone, we will **mark PRs as `spam` or `invalid`** if they:
- Are not linked to an open, assigned issue.
- Only make trivial changes (e.g. fixing a single typo in a README, adding whitespace).
- Are low-effort copy-pastes or auto-generated code without context.
- Introduce unrelated or breaking changes.

Pull requests that follow the guidelines and are merged (or labelled `hacktoberfest-accepted`) count toward your Hacktoberfest total.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Use welcoming and inclusive language.
- Be respectful of differing viewpoints and experiences.
- Gracefully accept constructive criticism.
- Focus on what is best for the community.
- Show empathy towards other community members.

---

## Development Setup

To get the codebase running locally for development:

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/stitch.git
   cd stitch
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp config.example.json config.json
   ```

4. **Verify GitHub CLI Setup**
   Ensure you have the GitHub CLI installed and configured locally:
   ```bash
   gh auth status
   ```

5. **Start Dev Mode**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` to interact with the frontend.

---

## Pull Request Guidelines

1. **Create a Feature Branch**: Always branch off of `main` for your modifications (e.g., `git checkout -b feature/awesome-thing`).
2. **Write Clean Code**: Follow existing code structure guidelines. Write meaningful variable names and preserve helper functions.
3. **Commit Messages**: Write clear, descriptive commit messages (e.g., `feat: add toast warnings on command timeout`).
4. **Push and Submit**: Push to your fork and submit a Pull Request back to our `main` branch. Provide a detailed summary in your PR describing your changes.

---

## Reporting Issues

- Use the GitHub Issue Tracker to report bugs or submit feature requests.
- Provide a clear title and description, steps to reproduce the issue, and expected behavior.
