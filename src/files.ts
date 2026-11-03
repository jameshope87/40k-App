/**
 * Saving files from the app. In a browser this is a normal download; in the
 * Android app (where WebView downloads don't work) the file is written to the
 * app cache and handed to the system share sheet, so it can be saved to Google
 * Drive, Files, email, etc.
 */
import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function saveTextFile(name: string, text: string, mime = 'application/json') {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: res.uri, dialogTitle: 'Save or share' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFileName(s: string) {
  return s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}
