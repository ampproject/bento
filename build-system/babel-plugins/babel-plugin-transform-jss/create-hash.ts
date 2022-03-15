import { createHash } from 'crypto';

// This is in its own file in order to make it easy to stub in tests.
export default {
  createHash: (filepath: string): string =>
    createHash('sha256')
      .update(toPosix(filepath))
      .digest('hex')
      .slice(0, 7),
};

/**
 * To support Windows, use posix separators for all filepath hashes.
 */
function toPosix(filepath: string): string {
  return filepath.replace(/\\\\?/g, '/');
}
