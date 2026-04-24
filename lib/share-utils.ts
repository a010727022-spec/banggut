import { toPng } from "html-to-image";

/**
 * Convert a DOM element (ShareCard) to a PNG Blob.
 */
export async function captureCardAsBlob(element: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(element, {
    width: 1080,
    height: 1350,
    pixelRatio: 1,
    cacheBust: true,
  });

  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Share a review card image using Web Share API (mobile) or fallback to clipboard text.
 */
export async function shareReviewCard({
  element,
  bookTitle,
  oneliner,
  shareUrl,
}: {
  element: HTMLElement;
  bookTitle: string;
  oneliner: string;
  shareUrl?: string;
}): Promise<"shared" | "copied" | "saved"> {
  const blob = await captureCardAsBlob(element);
  const file = new File([blob], `banggut-review-${Date.now()}.png`, {
    type: "image/png",
  });

  const shareText = [
    `"${bookTitle}" 서평`,
    oneliner ? `\n${oneliner}` : "",
    "\n\n방긋에서 읽고, 긋고, 방긋.",
    shareUrl ? `\n${shareUrl}` : "",
  ]
    .filter(Boolean)
    .join("");

  // Try native share with file (mobile)
  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `${bookTitle} 서평 - 방긋`,
        text: shareText,
        files: [file],
      });
      return "shared";
    } catch (err) {
      // User cancelled or share failed — fall through to fallback
      if ((err as Error)?.name === "AbortError") {
        return "shared"; // user cancelled, not an error
      }
    }
  }

  // Fallback: try copying text to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareText);
      return "copied";
    } catch {
      // clipboard failed, try download
    }
  }

  // Last fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `banggut-review-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "saved";
}
