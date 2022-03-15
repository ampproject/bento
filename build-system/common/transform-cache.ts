import { createHash } from 'crypto';
import { ensureDirSync, readdirSync, outputJson, readJson, readFile } from 'fs-extra';
import { join, resolve } from 'path';

/**
 * Used to bust caches when the TransformCache makes a breaking change to the API.
 */
const API_VERSION = 2;

/**
 * Cache for storing transformed files on both memory and on disk.
 */
export class TransformCache<T> {
  private cacheDir: string;
  private transformMap: Map<string, Promise<T>>;
  private fsCache: Set<string>;

  constructor(cacheName: string) {
    /** @type {string} */
    this.cacheDir = resolve(__dirname, '..', '..', cacheName);
    ensureDirSync(this.cacheDir);

    /** @type {Map<string, Promise<T>>} */
    this.transformMap = new Map();

    /** @type {Set<string>} */
    this.fsCache = new Set(readdirSync(this.cacheDir));
  }

  get(hash: string): null | Promise<T> {
    const cached = this.transformMap.get(hash);
    if (cached) {
      return cached;
    }

    const filename = this.key_(hash);
    if (this.fsCache.has(filename)) {
      const persisted = readJson(join(this.cacheDir, filename));
      this.transformMap.set(hash, persisted);
      return persisted;
    }

    return null;
  }

  set(hash: string, transformPromise: Promise<T>) {
    if (this.transformMap.has(hash)) {
      throw new Error(`Read race: Attempting to transform ${hash} file twice.`);
    }
    this.transformMap.set(hash, transformPromise);

    const filepath = join(this.cacheDir, this.key_(hash));
    transformPromise.then((contents) => outputJson(filepath, contents));
  }

  private key_(hash: string): string {
    return `${API_VERSION}_${hash}.json`;
  }
}

/**
 * Returns the md5 hash of provided args.
 */
export function md5(...args: Array<string | Buffer>): string {
  const hash = createHash('md5');
  for (const a of args) {
    hash.update(a);
  }
  return hash.digest('hex');
}

type ReadResult = {
  hash: string;
  contents: string;
};

/**
 * Used to cache file reads, since some (esbuild) will have multiple "loads" per
 * file. This batches consecutive reads into a single, and then clears its cache
 * item for the next load.
 */
const readCache = new Map<string, Promise<ReadResult>>();

/**
 * Returns the string contents and hash of the file at the specified  If
 * multiple reads are requested for the same file before the first read has
 * completed, the result will be reused.
 */
export async function batchedRead(path: string): Promise<ReadResult> {
  let read = readCache.get(path);
  if (!read) {
    read = readFile(path, 'utf8')
      .then((contents) => ({
        contents,
        hash: md5(contents),
      }))
      .finally(() => {
        readCache.delete(path);
      });
    readCache.set(path, read);
  }

  return read;
}
