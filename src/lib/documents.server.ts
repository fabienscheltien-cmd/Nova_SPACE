import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import { LOGO_H, LOGO_PNG_BASE64, LOGO_W } from "@/lib/logo-seine-avenue";
import { ROOMS, formatDateFR, formatDuration, toMinutes } from "@/lib/rooms";
import type { Report } from "@/lib/reporting.server";

const NAVY = "1F2F4F";
const BLUE = "2569A8";
const FONT = "Arial";

// A3 paysage : on passe les dimensions portrait, docx inverse.
const A3 = { width: 16838, height: 23811 };
const MARGIN = 1000;
const CONTENT_W = A3.height - MARGIN * 2;

function logo(width = 170) {
  const data = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
  return new ImageRun({
    type: "png",
    data,
    transformation: { width, height: Math.round((width * LOGO_H) / LOGO_W) },
    altText: { title: "Seine Avenue", description: "Logo Seine Avenue", name: "logo" },
  });
}

function endOf(slot: string, hours: number) {
  const m = toMinutes(slot) + hours * 60;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFC8D6" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, width: number, header = false, size = 26) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: header, color: header ? "FFFFFF" : "1A1A1A", size, font: FONT }),
        ],
      }),
    ],
  });
}

function table(headers: string[], ratios: number[], rows: string[][], size = 26) {
  const total = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => Math.floor((r / total) * CONTENT_W));
  widths[widths.length - 1]! += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i]!, true, size)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, widths[i]!, false, size)) })),
    ],
  });
}

const sectionProps = {
  page: {
    size: { ...A3, orientation: PageOrientation.LANDSCAPE },
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
  },
};

export interface SheetReservation {
  roomId: string;
  slot: string;
  hours: number;
  name: string;
  subject: string;
  confidential: boolean;
  companyName: string | null;
}

/** Fiche du jour : une page A3 paysage par salle. */
export async function buildDailySheet(date: string, reservations: SheetReservation[]) {
  const dateLabel = formatDateFR(date);
  const children: (Paragraph | Table)[] = [];

  ROOMS.forEach((room, idx) => {
    const list = reservations
      .filter((r) => r.roomId === room.id)
      .sort((a, b) => a.slot.localeCompare(b.slot));
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          logo(),
          new TextRun({ text: `\t${dateLabel}`, size: 32, color: BLUE, font: FONT, bold: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 500, after: 120 },
        children: [new TextRun({ text: "Bienvenue dans la Salle", size: 48, color: NAVY, font: FONT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: room.name, size: 96, bold: true, color: NAVY, font: FONT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
        children: [new TextRun({ text: room.location, size: 30, color: "5A6475", font: FONT })],
      }),
    );
    if (list.length === 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Aucune réservation ce jour.", size: 32, italics: true, font: FONT }),
          ],
        }),
      );
    } else {
      children.push(
        table(
          ["Horaire", "Durée", "Réservé par", "Société", "Objet"],
          [2, 1.3, 3, 3, 5],
          list.map((r) => [
            `${r.slot} – ${endOf(r.slot, r.hours)}`,
            formatDuration(r.hours),
            r.name,
            r.companyName ?? "—",
            r.confidential ? "Confidentiel" : r.subject,
          ]),
          30,
        ),
      );
    }
  });

  const doc = new Document({
    creator: "Nova Space",
    title: `Fiche du jour — ${dateLabel}`,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: sectionProps, children }],
  });
  return Packer.toBase64String(doc);
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, bold: true, size: 34, color: NAVY, font: FONT })],
  });
}

/** Rapport d'activité : A3 paysage. */
export async function buildReportDoc(report: Report, title: string) {
  const f = report.filters;
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      children: [
        logo(),
        new TextRun({
          text: `\tDu ${formatDateFR(f.from)} au ${formatDateFR(f.to)}`,
          size: 28,
          color: BLUE,
          font: FONT,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: title, bold: true, size: 56, color: NAVY, font: FONT })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${report.totalHours} h réservées · ${report.totalCount} réservations · occupation globale ${report.globalOccupancyPercent} % · durée moyenne ${report.avgDuration} h · ${report.confidentialPercent} % confidentielles`,
          size: 28,
          font: FONT,
        }),
      ],
    }),
    heading("Heures par société"),
    table(
      ["Société", "Heures", "Réservations", "Quota", "Utilisation quota", "Quote-part", "Part réelle", "Dépassements accordés"],
      [3, 1.2, 1.4, 1.2, 1.6, 1.3, 1.3, 2],
      report.companies.map((c) => [
        c.name,
        `${c.hours} h`,
        String(c.count),
        `${c.quotaHours} h`,
        `${c.quotaUsePercent} %`,
        `${c.sharePercent} %`,
        `${c.actualSharePercent} %`,
        `${c.overageApproved} h`,
      ]),
    ),
    heading("Occupation des salles"),
    table(
      ["Salle", "Heures", "Réservations", "Taux d'occupation"],
      [4, 2, 2, 2],
      report.rooms.map((r) => [r.name, `${r.hours} h`, String(r.count), `${r.occupancyPercent} %`]),
    ),
  ];
  const doc = new Document({
    creator: "Nova Space",
    title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: sectionProps, headers: { default: new Header({ children: [] }) }, children }],
  });
  return Packer.toBase64String(doc);
}
