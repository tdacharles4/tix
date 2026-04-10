import QRCode from 'qrcode';

/**
 * Generates a base64-encoded PNG QR code for a ticket.
 * The QR encodes only the ticket UUID — validation is always server-side.
 */
export async function generateQRCode(ticketId: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(ticketId, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return dataUrl; // data:image/png;base64,...
}
