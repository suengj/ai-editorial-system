#!/usr/bin/env python3
"""Build a card-only local review board and source receipt for VQ-V2 Round 3."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


W, H, GAP, PAD = 1120, 590, 36, 30
BG = (239, 238, 233)

CANDIDATES = [
    {
        "id": "R3-01", "file": "candidate-01-fsc-weekly.jpg",
        "title": "FSC 주간 금융소식", "url": "https://www.fsc.go.kr/no040000?cnId=745",
        "image_url": "https://www.fsc.go.kr/comm/getImage?fileNo=2&fileTy=ATTACH&srvcId=CARDNEWS&upperNo=745",
        "origin": "금융위원회 카드뉴스 원본 이미지", "ratings": [2, 1, 3, 4, 4],
        "traits": "번호가 먼저 보이는 정보 순서, 황색 강조어, 단순 반복 구조. 사진/그래픽 점유가 작고 박스 반복이 강함.",
    },
    {
        "id": "R3-02", "file": "candidate-02-ktv-finance.png",
        "title": "KTV 하반기 금융 변화", "url": "https://www.ktv.go.kr/online/cardnews/view?card_id=91",
        "image_url": "https://www.ktv.go.kr/media/cardnews/2024/07/15/QJtUL1U2fv.png",
        "origin": "KTV 카드뉴스 개별 원본 이미지", "ratings": [4, 5, 2, 5, 4],
        "traits": "큰 제목-일러스트-본문의 단계, 밝은 보라와 노랑 대비, 실제 정책 주제를 아이콘·인물 장면으로 묶음. 한 장에 정보가 많음.",
    },
    {
        "id": "R3-03", "file": "candidate-03-fsc-correction.jpg",
        "title": "FSC 금융위 설명 카드", "url": "https://www.fsc.go.kr/no040101?cnId=3110",
        "image_url": "https://www.fsc.go.kr/comm/getImage?fileNo=1&fileTy=ATTACH&srvcId=CARDNEWS&upperNo=3110",
        "origin": "금융위원회 개별 카드 원본 이미지", "ratings": [5, 1, 5, 5, 2],
        "traits": "한 문장 주장에 화면 대부분을 주는 타이포, 짙은 제목과 넓은 주변 여백, 상단 일러스트와 짧은 강조어.",
    },
    {
        "id": "R3-04", "file": "candidate-04-kird-gene-edit.png",
        "title": "K-클럽 유전자 교정 연구", "url": "https://k-club.kird.re.kr/prog/careerLibrary/career/sub02_02_03/view.do?libraryNo=395",
        "image_url": "https://k-club.kird.re.kr/thumbnail/careerLibrary/CL_20240925102019879Ax23.png",
        "origin": "K-클럽 개별 카드 원본 이미지", "ratings": [4, 5, 3, 4, 3],
        "traits": "연구자 사진을 오른쪽에 크게 두고 왼쪽 문장과 작은 과학 도해를 계층화. 사진과 편집형 그래픽의 역할이 분리됨.",
    },
    {
        "id": "R3-05", "file": "candidate-05-msit-biotech.png",
        "title": "과학기술정보통신부 바이오 카드", "url": "https://blog.naver.com/with_msip/222641117821",
        "image_url": "https://mblogthumb-phinf.pstatic.net/MjAyMjAyMDRfOCAg/MDAxNjQzOTUwOTE4OTIz.YgUprKuHhDKGB5qH7OeW00aLOahnBfEPUuLmuBHraR8g.nnUZE-_NjClmyEu9mGARJUErEGxJQHy8H2tYWdok71gg.PNG.with_msip/%EB%B0%94%EC%9D%B4%EC%98%A4.png?type=w800",
        "origin": "MSIT 공식 블로그 카드 원본 이미지", "ratings": [3, 4, 3, 4, 2],
        "traits": "DNA와 실험 장면을 한 그래픽으로 묶고 녹색 계열을 일관되게 사용. 제목은 선명하나 데이터 표현은 없음.",
    },
    {
        "id": "R3-06", "file": "candidate-06-scienceall-display.png",
        "title": "사이언스올 비싼 디스플레이", "url": "https://www.scienceall.com/brd/board/732/L/menu/272?bbsSn=413309&brdType=R",
        "image_url": "https://www.scienceall.com/jnrepo/upload/cmBbs/202412/833958e7a5e84912a7c5bd3be8dbd877_1733877538286.png",
        "origin": "사이언스올 개별 카드 원본 이미지", "ratings": [5, 5, 3, 5, 3],
        "traits": "노랑·파랑의 큰 제목 위계, 질문형 헤드라인, 제목 아래 화면·인물 삽화가 주제를 바로 설명. 대비와 그림 점유가 강함.",
    },
    {
        "id": "R3-07", "file": "candidate-07-kird-career.png",
        "title": "K-클럽 경력개발 설문", "url": "https://k-club.kird.re.kr/prog/careerLibrary/career/sub02_02_03/view.do?libraryNo=473",
        "image_url": "https://k-club.kird.re.kr/thumbnail/careerLibrary/CL_20250917132604068Kf60.png",
        "origin": "K-클럽 개별 카드 원본 이미지", "ratings": [5, 4, 4, 5, 5],
        "traits": "97.9% 수치를 큰 제목처럼 사용하고 그래프와 일러스트를 보조 역할로 배치. 강한 글자 크기 대비와 읽히는 통계 진입점.",
    },
    {
        "id": "R3-08", "file": "candidate-08-kigam-poem.jpg",
        "title": "KIGAM 연구원 소개 카드", "url": "https://www.kigam.re.kr/gallery.es?act=view&bid=0006&list_no=5198&mid=a10206090000",
        "image_url": "https://www.kigam.re.kr/upload/editor/168733714861400.jpg",
        "origin": "한국지질자원연구원 개별 카드 원본 이미지", "ratings": [3, 4, 3, 4, 1],
        "traits": "두 개의 큰 색면을 대화 순서로 구분하고 캐릭터가 시선을 유도. 친근하지만 정보 시각화는 제한적.",
    },
    {
        "id": "R3-09", "file": "candidate-09-kats-regulation.png",
        "title": "국가기술표준원 규제개선", "url": "https://kats.go.kr/content.do?cid=20638&cmsid=523&mode=view&page=1",
        "image_url": "https://kats.go.kr/upload/board/image/475/20638_201902281049464340.png",
        "origin": "국가기술표준원 개별 카드 원본 이미지", "ratings": [3, 1, 5, 3, 1],
        "traits": "한 줄 슬로건과 두 색의 강조로 여백을 크게 사용. 사진·그래픽과 데이터 위계가 약함.",
    },
    {
        "id": "R3-10", "file": "candidate-10-koreascientists.jpg",
        "title": "대한민국 과학기술유공자 인용 카드", "url": "https://www.koreascientists.kr/scientists/story/news/?boardId=bbs_0000000000000015&category=&cntId=119&mode=view&pageIdx=",
        "image_url": "https://www.koreascientists.kr/upload/editUpload/20250513/202505131013070736.jpg",
        "origin": "대한민국 과학기술유공자 개별 카드 원본 이미지", "ratings": [4, 4, 3, 4, 2],
        "traits": "인용을 말풍선에 먼저 띄우고 짙은 녹색과 분홍색의 작은 삽화로 인물 성격을 보탬. 본문이 다소 길다.",
    },
]

RUBRIC = ["type hierarchy", "image/graphic area", "intentional whitespace", "contrast", "information visualization"]


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True)
    args = ap.parse_args()
    root = args.root.resolve()
    font = ImageFont.load_default()
    canvas = Image.new("RGB", (2 * (W + GAP) + PAD * 2, 5 * (H + GAP) + PAD * 2), BG)
    draw = ImageDraw.Draw(canvas)
    receipt = {"schema_version": "vq-v2-round3-reference-candidates/1", "usage": "local visual review only; images remain copyrighted by their owners; no redistribution", "rubric_order": RUBRIC, "candidates": []}
    for i, row in enumerate(CANDIDATES):
        p = root / row["file"]
        im = Image.open(p).convert("RGB")
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        im = ImageOps.contain(im, (W, H), method=Image.Resampling.LANCZOS)
        tile_x = PAD + (i % 2) * (W + GAP)
        tile_y = PAD + (i // 2) * (H + GAP)
        canvas.paste(im, (tile_x + (W - im.width) // 2, tile_y + (H - im.height) // 2))
        draw.text((tile_x + 6, tile_y + 6), row["id"], font=font, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
        score = sum(row["ratings"])
        receipt["candidates"].append({**row, "path": str(p), "sha256": f"sha256:{digest}", "dimensions": list(Image.open(p).size), "ratings": dict(zip(RUBRIC, row["ratings"])), "score_out_of_25": score})
    ranked = sorted(receipt["candidates"], key=lambda x: (-x["score_out_of_25"], x["id"]))
    receipt["selected_top5_for_poc"] = [x["id"] for x in ranked[:5]]
    receipt["ranking_note"] = "Highest rubric total; manager's shortlist for a one-off art-direction experiment only. Owner selection/approval is still HUMAN_REQUIRED."
    canvas.save(root / "reference-candidates-board-v2.png", optimize=True)
    (root / "candidate-receipt-v2.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    board5 = Image.new("RGB", (3 * (W + GAP) + PAD * 2, 2 * (H + GAP) + PAD * 2), BG)
    bdraw = ImageDraw.Draw(board5)
    for i, row in enumerate(ranked[:5]):
        im = ImageOps.contain(Image.open(root / row["file"]).convert("RGB"), (W, H), method=Image.Resampling.LANCZOS)
        x = PAD + (i % 3) * (W + GAP); y = PAD + (i // 3) * (H + GAP)
        board5.paste(im, (x + (W-im.width)//2, y + (H-im.height)//2))
        bdraw.text((x + 6, y + 6), f"{row['id']}  {row['score_out_of_25']}/25", font=font, fill="white", stroke_width=2, stroke_fill="black")
    board5.save(root / "reference-top5-board-v2.png", optimize=True)
    print(json.dumps({"board": str(root / "reference-candidates-board-v2.png"), "top5_board": str(root / "reference-top5-board-v2.png"), "receipt": str(root / "candidate-receipt-v2.json"), "top5": receipt["selected_top5_for_poc"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
