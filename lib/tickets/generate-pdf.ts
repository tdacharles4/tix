import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateQRCode } from '@/lib/qr/generate';
import { signTicket } from '@/lib/qr/sign';

type TicketPDFInput = {
  ticketId: string;
  holderName: string;
  ticketType: string;
  eventTitle: string;
  eventDate: string | null;
  eventVenue: string | null;
};

/**
 * Generates a single-page ticket PDF with event info, holder name, and QR code.
 * Returns the PDF as a Uint8Array (raw bytes).
 */
export async function generateTicketPDF(input: TicketPDFInput): Promise<Uint8Array> {
  const { ticketId, holderName, ticketType, eventTitle, eventDate, eventVenue } = input;

  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const purple = rgb(0.467, 0.337, 0.847);   // #7756d8
  const darkGray = rgb(0.15, 0.15, 0.2);
  const midGray = rgb(0.42, 0.42, 0.47);
  const lightGray = rgb(0.88, 0.88, 0.9);
  const white = rgb(1, 1, 1);

  // ── Header background ──
  const headerH = 140;
  page.drawRectangle({
    x: 0, y: height - headerH, width, height: headerH,
    color: darkGray,
  });

  // "TU BOLETO" label
  page.drawText('TU BOLETO', {
    x: 30, y: height - 45,
    size: 10, font: fontBold, color: purple,
  });

  // Event title (truncate if long)
  const titleText = eventTitle.length > 36 ? eventTitle.slice(0, 34) + '…' : eventTitle;
  page.drawText(titleText, {
    x: 30, y: height - 72,
    size: 20, font: fontBold, color: white,
  });

  // Event date
  if (eventDate) {
    const formatted = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
    }).format(new Date(eventDate));

    page.drawText(formatted, {
      x: 30, y: height - 100,
      size: 10, font: fontRegular, color: lightGray,
    });
  }

  // Venue
  if (eventVenue) {
    page.drawText(eventVenue, {
      x: 30, y: height - 118,
      size: 10, font: fontRegular, color: lightGray,
    });
  }

  // ── Dashed separator ──
  const sepY = height - headerH - 10;
  for (let x = 20; x < width - 20; x += 8) {
    page.drawLine({
      start: { x, y: sepY },
      end: { x: x + 4, y: sepY },
      thickness: 1,
      color: lightGray,
    });
  }

  // ── Body ──
  let cursorY = sepY - 30;

  // Holder name
  page.drawText('TITULAR', {
    x: 30, y: cursorY,
    size: 9, font: fontBold, color: midGray,
  });
  cursorY -= 16;
  page.drawText(holderName || '—', {
    x: 30, y: cursorY,
    size: 14, font: fontBold, color: darkGray,
  });

  cursorY -= 28;

  // Ticket type
  page.drawText('TIPO DE BOLETO', {
    x: 30, y: cursorY,
    size: 9, font: fontBold, color: midGray,
  });
  cursorY -= 16;
  page.drawText(ticketType, {
    x: 30, y: cursorY,
    size: 13, font: fontRegular, color: darkGray,
  });

  // ── QR Code ──
  const signedToken = signTicket(ticketId);
  const qrDataUrl = await generateQRCode(signedToken);
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBytes = Buffer.from(qrBase64, 'base64');
  const qrImage = await doc.embedPng(qrBytes);

  const qrSize = 180;
  const qrX = (width - qrSize) / 2;
  const qrY = 90;

  page.drawImage(qrImage, {
    x: qrX, y: qrY,
    width: qrSize, height: qrSize,
  });

  // "Presenta este código en la entrada"
  page.drawText('Presenta este código en la entrada', {
    x: width / 2 - fontRegular.widthOfTextAtSize('Presenta este código en la entrada', 9) / 2,
    y: qrY - 16,
    size: 9, font: fontRegular, color: midGray,
  });

  // Ticket ID at bottom
  const idText = ticketId;
  const idWidth = fontRegular.widthOfTextAtSize(idText, 8);
  page.drawText(idText, {
    x: width / 2 - idWidth / 2,
    y: 40,
    size: 8, font: fontRegular, color: midGray,
  });

  return await doc.save();
}
