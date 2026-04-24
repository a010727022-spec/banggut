"""
방긋이 그리드 이미지 → 개별 PNG 10종 자동 크롭
- 검정 배경을 투명하게 변환
- 연결 컴포넌트로 각 캐릭터 자동 감지
- 지정된 파일명으로 저장

사용법:
    python scripts/crop-mascots.py
"""
from PIL import Image
import numpy as np
from pathlib import Path

# ── 경로 ───────────────────────────────────────────
ROOT = Path(__file__).parent.parent
SRC = ROOT / "public" / "mascot-grid.png"
OUT_DIR = ROOT / "public"

# ── 그리드 행/열 기준으로 (row, col) → 파일명 매핑 ───
# 그리드는 4열 x 3행 = 12슬롯. 일부 슬롯은 비어있을 수 있음.
# 사용자가 보낸 그리드 순서:
#   Row 1: sleeping, reading, happy-sparkle, shelter
#   Row 2: worried, worried-reading(알트), welcome, (empty)
#   Row 3: thinking, writing, morning, talking
NAME_MAP = {
    (0, 0): "mascot-idle.png",       # 자는 모습
    (0, 1): "mascot-reading.png",    # 책 읽는 모습
    (0, 2): "mascot-happy.png",      # 반짝이 눈 + 기뻐함
    (0, 3): "mascot-shelter.png",    # 책 우산
    (1, 0): "mascot-worried.png",    # 시무룩
    # (1, 1): "mascot-worried-alt.png", # 시무룩 읽기 (알트)
    (1, 2): "mascot-welcome.png",    # 인사 (한 팔 흔들)
    (2, 0): "mascot-thinking.png",   # ? 생각
    (2, 1): "mascot-writing.png",    # 펜 + 책상
    (2, 2): "mascot-morning.png",    # ^^ 큰 미소
    (2, 3): "mascot-talking.png",    # 말하기
}

# ── 처리 ───────────────────────────────────────────
def remove_black_bg(img: Image.Image, threshold: int = 30) -> Image.Image:
    """검정 배경을 투명으로 치환. threshold 아래 밝기 픽셀 → alpha 0"""
    img = img.convert("RGBA")
    arr = np.array(img)
    # RGB 평균이 threshold 미만이면 투명 처리
    rgb_mean = arr[:, :, :3].mean(axis=2)
    alpha_mask = rgb_mean < threshold
    arr[alpha_mask, 3] = 0
    return Image.fromarray(arr, "RGBA")

def grid_crop(img: Image.Image, rows: int = 3, cols: int = 4, pad: int = 10) -> list:
    """이미지를 rows x cols 그리드로 나누어 각 셀 크롭 + 내용물 bounding box로 타이트 크롭"""
    w, h = img.size
    cell_w = w // cols
    cell_h = h // rows
    crops = []
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w
            y0 = r * cell_h
            x1 = x0 + cell_w
            y1 = y0 + cell_h
            cell = img.crop((x0, y0, x1, y1))
            # 투명 아닌 영역의 bbox
            bbox = cell.getbbox()
            if bbox is None:
                crops.append(((r, c), None))
                continue
            # 패딩 추가
            left = max(0, bbox[0] - pad)
            top = max(0, bbox[1] - pad)
            right = min(cell.width, bbox[2] + pad)
            bottom = min(cell.height, bbox[3] + pad)
            tight = cell.crop((left, top, right, bottom))
            crops.append(((r, c), tight))
    return crops

def main():
    if not SRC.exists():
        print(f"❌ 원본 파일 없음: {SRC}")
        print("   위 경로에 _mascot-grid.png를 저장해주세요.")
        return

    print(f"✅ 원본 읽기: {SRC.name} ({SRC.stat().st_size // 1024} KB)")
    img = Image.open(SRC)
    print(f"   크기: {img.size}")

    # 1) 검정 배경 → 투명
    img_rgba = remove_black_bg(img)

    # 2) 3x4 그리드 크롭
    crops = grid_crop(img_rgba, rows=3, cols=4, pad=20)

    # 3) 네임 맵에 따라 저장
    saved = []
    skipped = []
    for (r, c), cell in crops:
        key = (r, c)
        if cell is None:
            skipped.append(f"({r},{c}) 빈 셀")
            continue
        filename = NAME_MAP.get(key)
        if filename is None:
            # 매핑에 없는 셀은 디버깅용으로 저장
            dbg = OUT_DIR / f"_debug-r{r}c{c}.png"
            cell.save(dbg)
            skipped.append(f"({r},{c}) → _debug-r{r}c{c}.png")
            continue
        out_path = OUT_DIR / filename
        cell.save(out_path)
        saved.append(f"  ✅ {filename}  ({cell.size[0]}×{cell.size[1]})")

    print("\n🎉 저장 완료")
    for line in saved:
        print(line)
    if skipped:
        print("\n⏭️  건너뛴 셀:")
        for s in skipped:
            print(f"  - {s}")

if __name__ == "__main__":
    main()
