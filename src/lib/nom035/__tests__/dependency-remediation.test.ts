import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../..");

type LockPackage = {
  version?: string;
  resolved?: string;
  integrity?: string;
};

type PackageLock = {
  packages: Record<string, LockPackage>;
};

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function lockPackagesNamed(lock: PackageLock, name: string): Array<[string, LockPackage]> {
  return Object.entries(lock.packages).filter(([packagePath]) =>
    packagePath.endsWith(`node_modules/${name}`)
  );
}

describe("B4.2.1 · versiones de dependencias remediadas", () => {
  const lock = JSON.parse(
    readFileSync(path.join(ROOT, "package-lock.json"), "utf8")
  ) as PackageLock;

  it("todas las copias de PostCSS son >= 8.5.18", () => {
    const copies = lockPackagesNamed(lock, "postcss");
    expect(copies.length).toBeGreaterThan(0);
    for (const [packagePath, entry] of copies) {
      expect(entry.version, packagePath).toBeDefined();
      expect(compareVersions(entry.version!, "8.5.18"), packagePath).toBeGreaterThanOrEqual(0);
    }
  });

  it("todas las copias de sharp son >= 0.35.0", () => {
    const copies = lockPackagesNamed(lock, "sharp");
    expect(copies.length).toBeGreaterThan(0);
    for (const [packagePath, entry] of copies) {
      expect(entry.version, packagePath).toBeDefined();
      expect(compareVersions(entry.version!, "0.35.0"), packagePath).toBeGreaterThanOrEqual(0);
    }
  });

  it("Next, PostCSS y sharp provienen de npm, tienen integridad y no son prerelease", () => {
    for (const name of ["next", "postcss", "sharp"]) {
      for (const [packagePath, entry] of lockPackagesNamed(lock, name)) {
        expect(entry.integrity, `${packagePath} integrity`).toMatch(/^sha512-/);
        expect(entry.resolved, `${packagePath} resolved`).toMatch(
          /^https:\/\/registry\.npmjs\.org\//
        );
        expect(entry.version, `${packagePath} version`).not.toMatch(
          /-(?:alpha|beta|canary|preview|rc)(?:[.-]|\d)/i
        );
      }
    }
  });
});

describe("B4.2.1 · sharp nativo", () => {
  it("genera y redimensiona una imagen completamente en memoria", async () => {
    const source = Buffer.from(
      '<svg width="12" height="8" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="12" height="8" fill="#2563eb"/>' +
        "</svg>"
    );

    const { data, info } = await sharp(source)
      .resize(6, 4)
      .png()
      .toBuffer({ resolveWithObject: true });
    const metadata = await sharp(data).metadata();

    expect(info.width).toBe(6);
    expect(info.height).toBe(4);
    expect(info.format).toBe("png");
    expect(metadata.width).toBe(6);
    expect(metadata.height).toBe(4);
  });
});
