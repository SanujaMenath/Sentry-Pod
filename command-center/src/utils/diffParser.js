/**
 * diffParser.js
 * Parses unified diff format into structured hunks with context
 * Similar to git diff format
 */

/**
 * Represents a single line in a diff
 */
class DiffLine {
  constructor(type, content, lineNum = null, origLineNum = null) {
    this.type = type; // 'context', 'addition', 'removal', 'header'
    this.content = content;
    this.lineNum = lineNum; // Line number in new file (for additions/context)
    this.origLineNum = origLineNum; // Line number in old file (for removals/context)
  }
}

/**
 * Represents a hunk (chunk of changes)
 */
class DiffHunk {
  constructor(header, startLine, lines = []) {
    this.header = header; // e.g., "@@ -1,9 +1,8 @@"
    this.startLine = startLine; // Starting line in original file
    this.lines = lines;
  }

  getStats() {
    const additions = this.lines.filter(l => l.type === 'addition').length;
    const removals = this.lines.filter(l => l.type === 'removal').length;
    return { additions, removals };
  }
}

/**
 * Represents the entire diff
 */
class ParsedDiff {
  constructor(fromFile, toFile, hunks = []) {
    this.fromFile = fromFile;
    this.toFile = toFile;
    this.hunks = hunks;
  }

  getStats() {
    let totalAdditions = 0;
    let totalRemovals = 0;

    this.hunks.forEach(hunk => {
      const stats = hunk.getStats();
      totalAdditions += stats.additions;
      totalRemovals += stats.removals;
    });

    return { totalAdditions, totalRemovals, hunksCount: this.hunks.length };
  }
}

/**
 * Parse unified diff format
 * @param {string} diffContent - Raw diff content
 * @returns {ParsedDiff} Structured diff data
 */
export function parseDiff(diffContent) {
  const lines = diffContent.split('\n');
  let fromFile = 'a/file';
  let toFile = 'b/file';
  const hunks = [];
  let currentHunk = null;
  let i = 0;

  // Parse headers
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('--- ')) {
      fromFile = line.substring(4).trim();
      i++;
    } else if (line.startsWith('+++ ')) {
      toFile = line.substring(4).trim();
      i++;
    } else if (line.startsWith('@@')) {
      // Start of a hunk
      const hunkHeader = line;
      currentHunk = new DiffHunk(hunkHeader);
      hunks.push(currentHunk);
      i++;

      // Parse hunk lines
      while (i < lines.length && !lines[i].startsWith('@@')) {
        const hunkLine = lines[i];

        if (hunkLine.startsWith('+') && !hunkLine.startsWith('+++')) {
          currentHunk.lines.push(
            new DiffLine('addition', hunkLine.substring(1), null, null)
          );
        } else if (hunkLine.startsWith('-') && !hunkLine.startsWith('---')) {
          currentHunk.lines.push(
            new DiffLine('removal', hunkLine.substring(1), null, null)
          );
        } else if (hunkLine.startsWith('\\')) {
          // "\ No newline at end of file" message - skip
          i++;
          continue;
        } else {
          // Context line
          currentHunk.lines.push(
            new DiffLine('context', hunkLine.substring(1), null, null)
          );
        }

        i++;
      }
    } else {
      i++;
    }
  }

  return new ParsedDiff(fromFile, toFile, hunks);
}

/**
 * Get diff summary for quick display
 * @param {ParsedDiff} diff
 * @returns {object} Summary stats
 */
export function getDiffSummary(diff) {
  return diff.getStats();
}

export { DiffLine, DiffHunk, ParsedDiff };
