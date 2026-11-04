import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { round2 } from '../utils/money';

interface PdfInput {
  type: 'invoice' | 'quotation' | 'purchase_order' | 'bill';
  document: any;
  organization: any;
  customer?: any;
}

const COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  brand: '#4f46e5',
  soft: '#f8fafc',
};

const TITLES: Record<PdfInput['type'], string> = {
  invoice: 'INVOICE',
  quotation: 'QUOTATION',
  purchase_order: 'PURCHASE ORDER',
  bill: 'VENDOR BILL',
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(round2(value));
}

function safeDate(value: Date | string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'MMM d, yyyy');
}

function addressLines(address: Record<string, string | undefined> | undefined): string[] {
  if (!address) return [];
  return [address.street, [address.city, address.state].filter(Boolean).join(', '), address.postalCode, address.country]
    .filter(Boolean)
    .map(String);
}

export async function generateDocumentPdf(input: PdfInput): Promise<Buffer> {
  const { document: docData, organization, customer } = input;
  const currency = organization?.settings?.currency ?? 'USD';
  const document = new PDFDocument({
    size: 'A4',
    margins: { top: 40, left: 40, right: 40, bottom: 50 },
    bufferPages: true,
    info: {
      Title: `${TITLES[input.type]} ${docData.number}`,
      Author: organization?.name ?? 'Aurora ERP',
      Creator: 'Aurora ERP',
    },
  });

  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  const pageWidth = document.page.width;
  const left = 40;
  const right = pageWidth - 40;
  const contentWidth = right - left;

  // Accent bar
  document.rect(0, 0, pageWidth, 6).fill(COLORS.brand);

  // Header
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(19).text(organization?.name ?? 'Aurora ERP', left, 34, { width: 300 });
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5);
  const orgAddress = addressLines(organization?.settings?.address);
  const orgMeta = [
    organization?.legalName,
    ...orgAddress,
    organization?.email,
    organization?.phone,
    organization?.settings?.website,
  ].filter(Boolean) as string[];
  document.text(orgMeta.join('\n'), left, 58, { width: 300, lineGap: 1.5 });

  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22).text(TITLES[input.type], left, 36, {
    width: contentWidth,
    align: 'right',
  });
  document.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  const metaRows: Array<[string, string]> = [
    ['Number', String(docData.number)],
    ['Date', safeDate(docData.issueDate ?? docData.date)],
  ];
  if (input.type === 'invoice') {
    metaRows.push(['Due', safeDate(docData.dueDate)]);
    metaRows.push(['Status', String(docData.status ?? '').toUpperCase()]);
  } else if (input.type === 'quotation') {
    metaRows.push(['Valid until', safeDate(docData.validUntil)]);
    metaRows.push(['Status', String(docData.status ?? '').toUpperCase()]);
  } else if (input.type === 'bill') {
    metaRows.push(['Due', safeDate(docData.dueDate)]);
    metaRows.push(['Status', String(docData.status ?? '').toUpperCase()]);
  } else {
    metaRows.push(['Expected', safeDate(docData.expectedDate)]);
    metaRows.push(['Status', String(docData.status ?? '').toUpperCase()]);
  }
  let metaY = 72;
  for (const [label, value] of metaRows) {
    document.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(label, left + 300, metaY, { width: 80, align: 'right' });
    document.fillColor(COLORS.ink).font('Helvetica-Bold').text(value, left + 385, metaY, { width: 90, align: 'right' });
    metaY += 14;
  }

  // Party block
  const partyY = Math.max(metaY + 12, 112);
  document.roundedRect(left, partyY, contentWidth, 66, 6).fill(COLORS.soft);
  document.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5).text(input.type === 'purchase_order' || input.type === 'bill' ? 'VENDOR' : 'BILL TO', left + 14, partyY + 12, { characterSpacing: 0.6 });
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(customer?.name ?? customer?.company ?? '—', left + 14, partyY + 25, { width: 240 });
  document.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
  const partyDetails = [
    customer?.company && customer?.company !== customer?.name ? customer.company : undefined,
    customer?.email,
    customer?.phone,
    ...addressLines(customer?.billingAddress ?? customer?.address),
  ].filter(Boolean) as string[];
  document.text(partyDetails.join(' · '), left + 14, partyY + 40, { width: contentWidth - 28, lineGap: 1 });

  // Table
  const columns = {
    index: { x: left, width: 24 },
    description: { x: left + 24, width: contentWidth - 24 - 50 - 72 - 50 - 78 },
    qty: { x: left + contentWidth - 228, width: 44 },
    price: { x: left + contentWidth - 184, width: 66 },
    tax: { x: left + contentWidth - 118, width: 40 },
    total: { x: left + contentWidth - 78, width: 78 },
  };
  let tableY = partyY + 82;

  const drawTableHeader = (y: number) => {
    document.rect(left, y, contentWidth, 22).fill('#eef2ff');
    document.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(7.5);
    document.text('#', columns.index.x + 4, y + 7, { width: columns.index.width });
    document.text('DESCRIPTION', columns.description.x, y + 7, { width: columns.description.width });
    document.text('QTY', columns.qty.x, y + 7, { width: columns.qty.width, align: 'right' });
    document.text('RATE', columns.price.x, y + 7, { width: columns.price.width, align: 'right' });
    document.text('TAX', columns.tax.x, y + 7, { width: columns.tax.width, align: 'right' });
    document.text('AMOUNT', columns.total.x, y + 7, { width: columns.total.width, align: 'right' });
    return y + 22;
  };

  tableY = drawTableHeader(tableY);
  const items: any[] = docData.items ?? [];
  items.forEach((item, index) => {
    const description = `${item.description ?? ''}${item.product?.sku ? `\n${item.product.sku}` : ''}`;
    const descriptionHeight = document.heightOfString(description, {
      width: columns.description.width - 8,
      lineGap: 1.5,
    });
    const rowHeight = Math.max(24, descriptionHeight + 12);
    if (tableY + rowHeight > document.page.height - 80) {
      document.addPage();
      tableY = 50;
      tableY = drawTableHeader(tableY);
    }
    if (index % 2 === 1) {
      document.rect(left, tableY, contentWidth, rowHeight).fill('#fbfcff');
    }
    document.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
    document.text(String(index + 1), columns.index.x + 4, tableY + 7, { width: columns.index.width });
    document.fillColor(COLORS.ink).font('Helvetica').fontSize(8.5).text(description, columns.description.x, tableY + 6, {
      width: columns.description.width - 8,
      lineGap: 1.5,
    });
    document.fillColor(COLORS.muted).fontSize(8.5);
    document.text(String(item.quantity), columns.qty.x, tableY + 7, { width: columns.qty.width, align: 'right' });
    document.text(money(item.unitPrice ?? item.unitCost ?? 0, currency), columns.price.x, tableY + 7, {
      width: columns.price.width,
      align: 'right',
    });
    document.text(`${item.taxRate ?? 0}%`, columns.tax.x, tableY + 7, { width: columns.tax.width, align: 'right' });
    document.fillColor(COLORS.ink).font('Helvetica-Bold').text(money(item.total ?? 0, currency), columns.total.x, tableY + 7, {
      width: columns.total.width,
      align: 'right',
    });
    document
      .moveTo(left, tableY + rowHeight)
      .lineTo(right, tableY + rowHeight)
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .stroke();
    tableY += rowHeight;
  });

  // Totals
  if (tableY + 160 > document.page.height - 60) {
    document.addPage();
    tableY = 50;
  }
  const totalsX = right - 210;
  let totalsY = tableY + 16;
  const totalRow = (label: string, value: number, bold = false) => {
    document
      .fillColor(bold ? COLORS.ink : COLORS.muted)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 10.5 : 8.8)
      .text(label, totalsX, totalsY, { width: 110, align: 'right' });
    document
      .fillColor(COLORS.ink)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 10.5 : 8.8)
      .text(money(value, currency), totalsX + 115, totalsY, { width: 95, align: 'right' });
    totalsY += bold ? 20 : 15;
  };
  totalRow('Subtotal', docData.subtotal ?? 0);
  if (docData.discountTotal) totalRow('Discount', -docData.discountTotal);
  if (docData.taxTotal) totalRow('Tax', docData.taxTotal);
  totalRow(input.type === 'invoice' || input.type === 'bill' ? 'Total' : 'Total', docData.total ?? 0, true);
  if (input.type === 'invoice' || input.type === 'bill') {
    if (docData.amountPaid) totalRow('Paid', docData.amountPaid);
    if (docData.balance !== undefined) totalRow('Balance due', docData.balance, true);
  }

  // Notes / terms
  const notes = [docData.notes, docData.terms].filter(Boolean) as string[];
  if (notes.length) {
    const notesY = Math.max(totalsY + 10, tableY + 20);
    if (notesY > document.page.height - 120) {
      document.addPage();
      renderNotes(document, left, 50, contentWidth, notes);
    } else {
      renderNotes(document, left, notesY + 10, 270, notes);
    }
  }

  document
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7.5)
    .text(
      `${organization?.appName ?? organization?.name ?? 'Aurora ERP'} · Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
      left,
      document.page.height - 42,
      { width: contentWidth, align: 'center' },
    );

  const pageRange = document.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    document.switchToPage(index);
    document
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`Page ${index + 1} of ${pageRange.count}`, right - 80, document.page.height - 42, {
        width: 80,
        align: 'right',
      });
  }

  document.end();
  return buffer;
}

function renderNotes(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  notes: string[],
) {
  document.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5).text('NOTES & TERMS', x, y, {
    characterSpacing: 0.5,
  });
  document
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8.5)
    .text(notes.join('\n\n'), x, y + 12, { width, lineGap: 2 });
}
