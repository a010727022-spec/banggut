// 카카오톡 공유 — 모임 초대
export function shareKakaoInvite(group: {
  name: string;
  invite_code: string;
  memberCount: number;
}, currentBook?: {
  title: string;
  cover_url?: string;
}) {
  if (!window.Kakao?.isInitialized()) return;

  const domain = window.location.origin;
  const joinUrl = `${domain}/groups/join?code=${group.invite_code}`;

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${group.name}에서 같이 읽어요`,
      description: currentBook
        ? `지금 읽는 책: ${currentBook.title} · ${group.memberCount}명이 함께`
        : `${group.memberCount}명이 함께 읽고 있어요`,
      imageUrl: currentBook?.cover_url || `${domain}/og-invite.png`,
      link: { mobileWebUrl: joinUrl, webUrl: joinUrl },
    },
    buttons: [{ title: "참여하기", link: { mobileWebUrl: joinUrl, webUrl: joinUrl } }],
  });
}

// 카카오톡 공유 — 완독 카드
export function shareKakaoCompletion(book: {
  title: string;
  author: string;
  cover_url?: string;
  reading_days: number;
}) {
  if (!window.Kakao?.isInitialized()) return;

  const domain = window.location.origin;

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${book.title} 완독!`,
      description: `${book.author} · ${book.reading_days}일 만에 읽었어요`,
      imageUrl: book.cover_url || `${domain}/og-completion.png`,
      link: { mobileWebUrl: domain, webUrl: domain },
    },
    buttons: [{ title: "방긋에서 보기", link: { mobileWebUrl: domain, webUrl: domain } }],
  });
}

// 텍스트 복사 — 모임 초대
export async function copyInviteText(group: {
  name: string;
  invite_code: string;
}, currentBook?: { title: string }) {
  const domain = window.location.origin;
  const joinUrl = `${domain}/groups/join?code=${group.invite_code}`;

  const text = currentBook
    ? `같이 ${currentBook.title} 읽자!\n\n${group.name}에서 지금 ${currentBook.title} 읽고 있어.\n같이 읽으면 더 재밌어 :)\n\n${joinUrl}\n\n초대 코드: ${group.invite_code}\n\n방긋 — 읽고, 긋고, 방긋 ‿`
    : `${group.name}에 초대할게!\n\n같이 책 읽자 :)\n\n${joinUrl}\n\n초대 코드: ${group.invite_code}\n\n방긋 — 읽고, 긋고, 방긋 ‿`;

  await navigator.clipboard.writeText(text);
  return text;
}

// 링크만 복사
export async function copyInviteLink(inviteCode: string) {
  const domain = window.location.origin;
  const url = `${domain}/groups/join?code=${inviteCode}`;
  await navigator.clipboard.writeText(url);
  return url;
}

// 코드만 복사
export async function copyInviteCode(inviteCode: string) {
  await navigator.clipboard.writeText(inviteCode);
  return inviteCode;
}

// 웹 공유 API (카카오 안 될 때 fallback)
export async function shareNative(group: {
  name: string;
  invite_code: string;
}, currentBook?: { title: string }) {
  const domain = window.location.origin;
  const joinUrl = `${domain}/groups/join?code=${group.invite_code}`;

  if (navigator.share) {
    await navigator.share({
      title: `${group.name} 초대`,
      text: currentBook
        ? `같이 ${currentBook.title} 읽자!`
        : `${group.name}에서 같이 책 읽자!`,
      url: joinUrl,
    });
  } else {
    await copyInviteLink(group.invite_code);
  }
}
