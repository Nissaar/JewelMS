import axios from 'axios';

/**
 * Opens a file that needs the login token (PDFs, photos) in a new tab. The
 * token is added by the axios interceptor in AuthContext.
 *
 * The tab is opened synchronously inside the click so popup blockers allow it,
 * then pointed at the downloaded blob. The blob URL is released afterwards.
 */
export async function openAuthenticatedFile(url: string): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const res = await axios.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(res.data);
    if (win) win.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}

/** Downloads a file that needs the login token under the given name. */
export async function downloadAuthenticatedFile(url: string, fileName: string): Promise<void> {
  const res = await axios.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
