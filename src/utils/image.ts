/** Builds a Wix static-media URL from a media id (e.g. "3510f9_xxxx~mv2.jpg"). */
export function wixImg(mediaId: string): string {
  return `https://static.wixstatic.com/media/${mediaId}`;
}
