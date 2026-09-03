/**
 * B4.27 — Auditoría estructural de XLSX (media/drawings/anchors).
 * No sustituye verificación visual, pero demuestra asociación real de drawings.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { pngHasVisibleInk, isLikelyPng } from "@/lib/nom035/report-charts";

export type SheetImageAudit = {
  sheetName: string;
  drawingPath: string | null;
  imageCount: number;
  anchors: Array<{
    fromRow: number;
    fromCol: number;
    toRow: number | null;
    toCol: number | null;
  }>;
  mediaTargets: string[];
};

export type XlsxVisualAudit = {
  mediaCount: number;
  drawingCount: number;
  imagesBySheet: Record<string, number>;
  sheets: SheetImageAudit[];
  pngBuffers: Buffer[];
  activeTab: number | null;
  firstSheetName: string | null;
  visibleInkFlags: boolean[];
};

function parseAnchorRow(xml: string, tag: "from" | "to"): number | null {
  const block = xml.match(new RegExp(`<xdr:${tag}>[\\s\\S]*?</xdr:${tag}>`));
  if (!block) return null;
  const row = block[0].match(/<xdr:row>(\d+)<\/xdr:row>/);
  return row ? Number(row[1]) : null;
}

function parseAnchorCol(xml: string, tag: "from" | "to"): number | null {
  const block = xml.match(new RegExp(`<xdr:${tag}>[\\s\\S]*?</xdr:${tag}>`));
  if (!block) return null;
  const col = block[0].match(/<xdr:col>(\d+)<\/xdr:col>/);
  return col ? Number(col[1]) : null;
}

export async function auditXlsxVisualStructure(
  xlsxBuffer: Buffer
): Promise<XlsxVisualAudit> {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const mediaFiles = Object.keys(zip.files).filter(
    (p) => p.startsWith("xl/media/") && !zip.files[p]?.dir && Boolean(zip.file(p))
  );
  const drawingFiles = Object.keys(zip.files).filter(
    (p) =>
      p.startsWith("xl/drawings/drawing") &&
      p.endsWith(".xml") &&
      !zip.files[p]?.dir
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuffer as unknown as ExcelJS.Buffer);
  const activeTab =
    typeof wb.views?.[0]?.activeTab === "number" ? wb.views[0].activeTab : null;
  const firstSheetName = wb.worksheets[0]?.name ?? null;

  const workbookRels = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  const sheetRels: Array<{ name: string; target: string }> = [];
  if (workbookRels) {
    const sheetsXml = await zip.file("xl/workbook.xml")?.async("text");
    const nameByRid = new Map<string, string>();
    if (sheetsXml) {
      const sheetTags = sheetsXml.matchAll(
        /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g
      );
      for (const m of sheetTags) {
        nameByRid.set(m[2]!, m[1]!);
      }
    }
    const relTags = workbookRels.matchAll(
      /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g
    );
    for (const m of relTags) {
      const name = nameByRid.get(m[1]!);
      if (name && m[2]?.startsWith("worksheets/")) {
        sheetRels.push({ name, target: m[2] });
      }
    }
  }

  const imagesBySheet: Record<string, number> = {};
  const sheets: SheetImageAudit[] = [];
  const pngBuffers: Buffer[] = [];

  for (const mediaPath of mediaFiles) {
    const buf = Buffer.from(await zip.file(mediaPath)!.async("uint8array"));
    if (isLikelyPng(buf)) pngBuffers.push(buf);
  }

  for (const { name, target } of sheetRels) {
    const sheetFile = target.replace(/^\//, "");
    const relsPath = `xl/worksheets/_rels/${sheetFile.split("/").pop()}.rels`;
    const relsXml = await zip.file(relsPath)?.async("text");
    let drawingPath: string | null = null;
    const mediaTargets: string[] = [];
    const anchors: SheetImageAudit["anchors"] = [];

    if (relsXml) {
      const drawRel = relsXml.match(
        /Target="([^"]*drawings\/drawing[^"]+)"/
      );
      if (drawRel?.[1]) {
        drawingPath = drawRel[1].startsWith("xl/")
          ? drawRel[1]
          : `xl/worksheets/${drawRel[1].replace(/^\.\.\//, "")}`.replace(
              "worksheets/../drawings",
              "drawings"
            );
        if (drawingPath.includes("drawings/")) {
          drawingPath = `xl/drawings/${drawingPath.split("drawings/")[1]}`;
        }
      }
    }

    if (drawingPath) {
      const drawingXml = await zip.file(drawingPath)?.async("text");
      const drawingRelsPath = drawingPath.replace(
        "xl/drawings/",
        "xl/drawings/_rels/"
      ) + ".rels";
      // xl/drawings/_rels/drawing1.xml.rels
      const fixedRels = `xl/drawings/_rels/${drawingPath.split("/").pop()}.rels`;
      const dRels = await zip.file(fixedRels)?.async("text");
      void drawingRelsPath;
      if (dRels) {
        for (const m of dRels.matchAll(/Target="([^"]+)"/g)) {
          if (m[1]?.includes("media/")) mediaTargets.push(m[1]);
        }
      }
      if (drawingXml) {
        const anchorsXml = drawingXml.match(
          /<xdr:(twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(twoCellAnchor|oneCellAnchor)>/g
        );
        for (const block of anchorsXml ?? []) {
          anchors.push({
            fromRow: parseAnchorRow(block, "from") ?? -1,
            fromCol: parseAnchorCol(block, "from") ?? -1,
            toRow: parseAnchorRow(block, "to"),
            toCol: parseAnchorCol(block, "to"),
          });
        }
      }
    }

    imagesBySheet[name] = anchors.length;
    sheets.push({
      sheetName: name,
      drawingPath,
      imageCount: anchors.length,
      anchors,
      mediaTargets,
    });
  }

  const visibleInkFlags = await Promise.all(
    pngBuffers.map((b) => pngHasVisibleInk(b, 0.008))
  );

  return {
    mediaCount: mediaFiles.length,
    drawingCount: drawingFiles.length,
    imagesBySheet,
    sheets,
    pngBuffers,
    activeTab,
    firstSheetName,
    visibleInkFlags,
  };
}

export async function writeAuditArtifacts(
  audit: XlsxVisualAudit,
  outDir: string
): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "audit.json"),
    JSON.stringify(
      {
        mediaCount: audit.mediaCount,
        drawingCount: audit.drawingCount,
        imagesBySheet: audit.imagesBySheet,
        activeTab: audit.activeTab,
        firstSheetName: audit.firstSheetName,
        sheets: audit.sheets,
        visibleInkFlags: audit.visibleInkFlags,
      },
      null,
      2
    )
  );
  for (let i = 0; i < audit.pngBuffers.length; i++) {
    writeFileSync(join(outDir, `chart-${i + 1}.png`), audit.pngBuffers[i]!);
  }
}
