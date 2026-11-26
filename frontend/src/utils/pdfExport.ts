import api from '../api/client';

function extractFilenameFromHeader(disposition?: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^";\r\n]+)"?/i.exec(disposition);
  return match?.[1]?.trim() || null;
}

async function fetchVerifiedPdfBlob(
  apiPath: string,
  fallbackFilename: string,
  params?: Record<string, unknown>
): Promise<{ blob: Blob; filename: string }> {
  const cleanPath = apiPath.startsWith('/api/') ? apiPath.slice(4) : apiPath;
  const res = await api.get(cleanPath, {
    params,
    responseType: 'blob',
  });

  const rawBlob: Blob =
    res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });

  const headerSlice = new Uint8Array(await rawBlob.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...headerSlice);
  if (magic !== '%PDF-') {
    throw new Error('Server did not return a valid PDF document.');
  }

  const pdfBlob =
    rawBlob.type === 'application/pdf'
      ? rawBlob
      : new Blob([rawBlob], { type: 'application/pdf' });

  const serverName = extractFilenameFromHeader(
    (res.headers as Record<string, string | undefined>)?.['content-disposition']
  );
  return {
    blob: pdfBlob,
    filename: serverName || fallbackFilename,
  };
}

function triggerAnchorDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Fetch an authenticated ReportLab PDF from the backend, verify its `%PDF-` header,
 * and download it directly to disk without ever invoking `window.print()` on the web screen.
 */
export async function downloadPdfFromApi(
  apiPath: string,
  fallbackFilename: string,
  params?: Record<string, unknown>
): Promise<void> {
  const { blob, filename } = await fetchVerifiedPdfBlob(apiPath, fallbackFilename, params);
  const blobUrl = window.URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(blobUrl, filename);
  } finally {
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
  }
}

/**
 * Fetch an authenticated ReportLab PDF and open it in the browser's standalone PDF viewer tab
 * ready for 1-click printing (falling back to direct file download if popups are blocked).
 * Never prints the live web app UI or uses `document.write()`.
 */
export async function openPdfForPrintFromApi(
  apiPath: string,
  fallbackFilename: string,
  params?: Record<string, unknown>
): Promise<void> {
  const { blob, filename } = await fetchVerifiedPdfBlob(apiPath, fallbackFilename, {
    ...(params || {}),
    inline: true,
  });
  const blobUrl = window.URL.createObjectURL(blob);
  const openedTab = window.open(blobUrl, '_blank', 'noopener');
  if (!openedTab) {
    triggerAnchorDownload(blobUrl, filename);
  }
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120_000);
}
