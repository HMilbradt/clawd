#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate changelog from git tags and commits
 * This script creates/updates CHANGELOG.md based on git history
 */
async function generateChangelog() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  try {
    // Get all tags sorted by version
    let tags = [];
    try {
      const tagOutput = execSync('git tag -l "v*" --sort=-version:refname', { encoding: 'utf-8' });
      tags = tagOutput.trim().split('\n').filter(Boolean);
    } catch (error) {
      console.log('No tags found yet. This will be the initial release.');
    }

    // Get package version
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    const currentVersion = packageJson.version;

    let changelog = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n`;
    changelog += `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n`;
    changelog += `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;

    // Add unreleased/current version
    if (tags.length === 0 || !tags.includes(`v${currentVersion}`)) {
      changelog += `## [${currentVersion}] - ${new Date().toISOString().split('T')[0]}\n\n`;

      // Get commits since last tag or all commits if no tags
      let commits;
      if (tags.length > 0) {
        try {
          commits = execSync(`git log ${tags[0]}..HEAD --pretty=format:"%s"`, { encoding: 'utf-8' });
        } catch (error) {
          commits = execSync('git log --pretty=format:"%s"', { encoding: 'utf-8' });
        }
      } else {
        try {
          commits = execSync('git log --pretty=format:"%s"', { encoding: 'utf-8' });
        } catch (error) {
          commits = '';
        }
      }

      const commitLines = commits.trim().split('\n').filter(Boolean);

      // Categorize commits (conventional commits format)
      const added = [];
      const changed = [];
      const fixed = [];
      const other = [];

      commitLines.forEach(commit => {
        // Parse conventional commit format: type(scope): message
        const conventionalMatch = commit.match(/^(\w+)(?:\([^)]+\))?:\s*(.+)$/);

        if (conventionalMatch) {
          const [, type, message] = conventionalMatch;
          const formattedMessage = message.charAt(0).toUpperCase() + message.slice(1);

          if (type === 'feat') {
            added.push(formattedMessage);
          } else if (type === 'fix') {
            fixed.push(formattedMessage);
          } else if (['refactor', 'perf', 'style', 'chore'].includes(type)) {
            changed.push(formattedMessage);
          } else if (type === 'docs') {
            changed.push(formattedMessage);
          } else {
            other.push(commit);
          }
        } else {
          // Fallback for non-conventional commits
          const lower = commit.toLowerCase();
          if (lower.startsWith('add') || lower.startsWith('feat')) {
            added.push(commit);
          } else if (lower.startsWith('fix')) {
            fixed.push(commit);
          } else if (lower.startsWith('update') || lower.startsWith('change') || lower.startsWith('refactor')) {
            changed.push(commit);
          } else {
            other.push(commit);
          }
        }
      });

      if (added.length > 0) {
        changelog += `### Added\n`;
        added.forEach(commit => changelog += `- ${commit}\n`);
        changelog += '\n';
      }

      if (changed.length > 0) {
        changelog += `### Changed\n`;
        changed.forEach(commit => changelog += `- ${commit}\n`);
        changelog += '\n';
      }

      if (fixed.length > 0) {
        changelog += `### Fixed\n`;
        fixed.forEach(commit => changelog += `- ${commit}\n`);
        changelog += '\n';
      }

      if (other.length > 0 && (added.length > 0 || changed.length > 0 || fixed.length > 0)) {
        changelog += `### Other\n`;
        other.forEach(commit => changelog += `- ${commit}\n`);
        changelog += '\n';
      } else if (other.length > 0) {
        // If no categorized commits, just list all
        other.forEach(commit => changelog += `- ${commit}\n`);
        changelog += '\n';
      }

      if (commitLines.length === 0) {
        changelog += `### Added\n`;
        changelog += `- Initial release\n`;
        changelog += `- Claude Code CLI wrapper for multi-phase project execution\n`;
        changelog += `- Interactive TUI mode with animated spinner\n`;
        changelog += `- Phase-based project planning and execution\n`;
        changelog += `- Real-time prompt queuing during execution\n\n`;
      }
    }

    // Process existing tags
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const version = tag.replace(/^v/, '');

      // Get tag date
      const tagDate = execSync(`git log -1 --format=%ai ${tag}`, { encoding: 'utf-8' }).split(' ')[0];

      changelog += `## [${version}] - ${tagDate}\n\n`;

      // Get commits between this tag and previous tag (or beginning)
      let commits;
      if (i < tags.length - 1) {
        commits = execSync(`git log ${tags[i + 1]}..${tag} --pretty=format:"%s"`, { encoding: 'utf-8' });
      } else {
        commits = execSync(`git log ${tag} --pretty=format:"%s"`, { encoding: 'utf-8' });
      }

      const commitLines = commits.trim().split('\n').filter(Boolean);
      commitLines.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }

    // Write changelog
    await fs.writeFile(changelogPath, changelog);
    console.log('✓ CHANGELOG.md generated successfully');

  } catch (error) {
    console.error('Error generating changelog:', error.message);
    process.exit(1);
  }
}

generateChangelog();
