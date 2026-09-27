import axios from 'axios';

/**
 * Opens a file that needs the login token (PDFs, photos) in a new tab.
 *
 * The tab is opened synchronously inside the click so popup blockers allow it,
 * then pointed at the downloaded blob. The blob URL is released afterwards.
 */
export async function openAuthenticatedFile(url: string, token: string | null): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const res = await axios.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    });
    const blobUrl = URL.createObjectURL(res.data);
    if (win) win.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}
