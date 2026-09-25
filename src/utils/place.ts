/** "Beylikdüzü" -> "beylikduzu": the key used for place names in the `places` dictionaries. */
export function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase();
}
