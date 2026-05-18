/**
 * Helper to trigger a file download from a URL.
 * @param url The URL of the file to download
 * @param fileName The name to save the file as
 */
export const downloadFile = (url: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
