#!/usr/bin/env python3
"""
Luna Lounge test shop: меню + фото, либо только перезаливка картинок.

По умолчанию фото **001.jpg, 002.jpg, …** сопоставляются с блюдами **в порядке MENU** (1:1).
Раньше был шаг 3 — он давал неверные пары.

Usage:
  python3 scripts/luna_menu_import.py --photos "/abs/path/to/Photos"
  python3 scripts/luna_menu_import.py --photos "..." --images-only   # только image, id товаров не трогаем

Override номеров jpg (индекс блюда 0..50 → номер файла 1-based):
  --mapping-file map.json  как объект {"0": 3, "10": 45} или массив [3, 4, 5, ...] длины 51.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

SHOP_ID = "7d542a63-c3f7-4b90-bf31-074e4e3c06c7"
RESTAURANT_ID = "0d08d0a6-9eaa-4943-8b1f-bcc7416fbe7c"
BUCKET = "organization-media"
HERO_W, HERO_H = 488, 224
CARD_SIDE = 256
# Дефолт: блюдо с индексом i → файл (i + 1). Переопределение через --mapping-file.
PHOTO_STRIDE = 1

MENU: list[dict] = [
    # Завтраки
    {"cat": "Завтраки", "name": "Английский", "price": 400, "desc": "300 г. Подаётся с 08:00 до 12:00."},
    {"cat": "Завтраки", "name": "Овсяноблин", "price": 200, "desc": "280 г. Подаётся с 08:00 до 12:00."},
    {"cat": "Завтраки", "name": "Фирменный", "price": 390, "desc": "350 г. Подаётся с 08:00 до 12:00."},
    {"cat": "Завтраки", "name": "Каша овсяная", "price": 140, "desc": "200 г. Подаётся с 08:00 до 12:00."},
    {"cat": "Завтраки", "name": "Каша рисовая", "price": 140, "desc": "200 г. Подаётся с 08:00 до 12:00."},
    {"cat": "Завтраки", "name": "Масло сливочное", "price": 40, "desc": "20 г. Подаётся с 08:00 до 12:00."},
    # Напитки
    {"cat": "Напитки", "name": "Чай пакетированный", "price": 50, "desc": "250 мл"},
    {"cat": "Напитки", "name": "Чай зелёный плиточный", "price": 60, "desc": "300 мл"},
    {"cat": "Напитки", "name": "Компот", "price": 60, "desc": "250 мл"},
    {"cat": "Напитки", "name": "Кофе (3 в 1)", "price": 60, "desc": "300 мл"},
    {"cat": "Напитки", "name": "Морс облепиха", "price": 65, "desc": "250 мл"},
    {"cat": "Напитки", "name": "Натахтари", "price": 200, "desc": "0,5 л"},
    {"cat": "Напитки", "name": "Энергетик Вольт", "price": 160, "desc": "0,45 л"},
    {"cat": "Напитки", "name": "Zeno", "price": 150, "desc": "0,45 л"},
    # Супы
    {"cat": "Супы", "name": "Солянка", "price": 220, "desc": "400 г"},
    {"cat": "Супы", "name": "Борщ", "price": 260, "desc": "400 г"},
    {"cat": "Супы", "name": "Талын шулэн", "price": 290, "desc": "400 г"},
    {"cat": "Супы", "name": "Баншатай", "price": 290, "desc": "400 г"},
    {"cat": "Супы", "name": "Шулэн", "price": 270, "desc": "350 г"},
    # Горячее
    {"cat": "Горячее", "name": "Бууза", "price": 80, "desc": "80 г"},
    {"cat": "Горячее", "name": "Жареная бууза", "price": 110, "desc": "100 г"},
    {"cat": "Горячее", "name": "Замороженные буузы", "price": 85, "desc": "75 г"},
    {"cat": "Горячее", "name": "Цуйван", "price": 320, "desc": "300 г"},
    {"cat": "Горячее", "name": "Спагетти с фаршем и сыром", "price": 320, "desc": "300 г"},
    {"cat": "Горячее", "name": "Дамбар", "price": 330, "desc": "300 г"},
    {"cat": "Горячее", "name": "Жареха со свининой", "price": 320, "desc": "300 г"},
    {"cat": "Горячее", "name": "Жареха с печенью", "price": 320, "desc": "300 г"},
    {"cat": "Горячее", "name": "Картофель фри", "price": 150, "desc": "100 г"},
    {"cat": "Горячее", "name": "Паста карбонара", "price": 290, "desc": "280 г"},
    {"cat": "Горячее", "name": "Бефстроганов", "price": 350, "desc": "300 г"},
    {"cat": "Горячее", "name": "Котлета по-домашнему", "price": 220, "desc": "150 г"},
    # Салаты
    {"cat": "Салаты", "name": "Белокочанная с морковью", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Морковь острая", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Свёкла с чесноком", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Селёдка под шубой", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Витаминный", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Оливье", "price": 120, "desc": "100 г"},
    {"cat": "Салаты", "name": "Фунчоза", "price": 120, "desc": "100 г"},
    # Выпечка
    {"cat": "Выпечка", "name": "Хлеб белый", "price": 5, "desc": "25 г"},
    {"cat": "Выпечка", "name": "Хлеб чёрный", "price": 5, "desc": "25 г"},
    {"cat": "Выпечка", "name": "Хлеб тостовый", "price": 20, "desc": "35 г"},
    {"cat": "Выпечка", "name": "\u0425\u0443\u0448\u0443\u0443\u0440 \u0441 \u043c\u044f\u0441\u043e\u043c", "price": 150, "desc": "110 г"},
    {"cat": "Выпечка", "name": "\u0425\u0443\u0448\u0443\u0443\u0440 \u0441 \u0441\u044b\u0440\u043e\u043c", "price": 150, "desc": "110 г"},
    {
        "cat": "Выпечка",
        "name": "\u0425\u0443\u0448\u0443\u0443\u0440 \u0441 \u043c\u044f\u0441\u043e\u043c \u0438 \u0441\u044b\u0440\u043e\u043c",
        "price": 170,
        "desc": "130 г",
    },
    {
        "cat": "Выпечка",
        "name": "\u0425\u0443\u0448\u0443\u0443\u0440 \u0441 \u043c\u044f\u0441\u043e\u043c \u0438 \u0441\u044b\u0440\u043e\u043c XL",
        "price": 240,
        "desc": "200 г",
    },
    {
        "cat": "Выпечка",
        "name": "\u0425\u0443\u0448\u0443\u0443\u0440 \u0441 \u043c\u044f\u0441\u043e\u043c XL",
        "price": 230,
        "desc": "200 г",
    },
    # Гарниры
    {"cat": "Гарниры", "name": "Рис отварной", "price": 90, "desc": "150 г"},
    {"cat": "Гарниры", "name": "Пюре", "price": 90, "desc": "150 г"},
    {"cat": "Гарниры", "name": "Спагетти", "price": 90, "desc": "180 г"},
    # Десерты
    {"cat": "Десерты", "name": "Блины", "price": 110, "desc": "120 г"},
    {"cat": "Десерты", "name": "Боовы", "price": 130, "desc": "100 г"},
]


def load_env(path: Path) -> tuple[str, str]:
    raw = path.read_text(encoding="utf-8")
    url = None
    key = None
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("SUPABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env")
    return url.rstrip("/"), key


def rest_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def card_webp_from_file(path: Path) -> bytes:
    im = Image.open(path).convert("RGB")
    im.thumbnail((4000, 4000), Image.Resampling.LANCZOS)
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im = im.resize((CARD_SIDE, CARD_SIDE), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format="WEBP", quality=82, method=6)
    return buf.getvalue()


def hero_webp_from_file(path: Path) -> bytes:
    im = Image.open(path).convert("RGB")
    im.thumbnail((4000, 4000), Image.Resampling.LANCZOS)
    w, h = im.size
    target_ratio = HERO_W / HERO_H
    cur_ratio = w / h
    if cur_ratio > target_ratio:
        # too wide — crop width
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))
    im = im.resize((HERO_W, HERO_H), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format="WEBP", quality=82, method=6)
    return buf.getvalue()


def upload_object(
    supabase_url: str,
    key: str,
    object_path: str,
    body: bytes,
    content_type: str,
) -> str:
    u = f"{supabase_url}/storage/v1/object/{BUCKET}/{object_path}"
    r = requests.post(
        u,
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        timeout=120,
    )
    if r.status_code not in (200, 201):
        sys.exit(f"Upload failed {object_path}: {r.status_code} {r.text}")
    return f"{supabase_url}/storage/v1/object/public/{BUCKET}/{object_path}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", type=Path, default=Path(".env"))
    ap.add_argument("--photos", type=Path, required=True)
    ap.add_argument("--mapping-file", type=Path, default=None)
    ap.add_argument(
        "--images-only",
        action="store_true",
        help="Не удалять категории/товары: обновить только image у существующих позиций (по sort_order).",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    repo = Path(__file__).resolve().parents[1]
    os.chdir(repo)

    supabase_url, service_key = load_env(args.env)

    mapping: dict[int, int] = {}
    if args.mapping_file and args.mapping_file.exists():
        raw = json.loads(args.mapping_file.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            mapping = {i: int(v) for i, v in enumerate(raw)}
        elif isinstance(raw, dict):
            mapping = {int(k): int(v) for k, v in raw.items()}
        else:
            sys.exit("--mapping-file: ожидается JSON-массив чисел или объект {индекс: номер_фото}")

    photos_dir: Path = args.photos
    if not photos_dir.is_dir():
        sys.exit(f"Photos dir not found: {photos_dir}")

    def photo_num_for_dish(idx: int) -> int:
        if idx in mapping:
            return mapping[idx]
        return idx * PHOTO_STRIDE + 1  # при PHOTO_STRIDE=1: 1,2,3,...

    def photo_path_for_dish(idx: int) -> Path:
        n = photo_num_for_dish(idx)
        for ext in (".jpg", ".JPG", ".jpeg", ".JPEG"):
            p = photos_dir / f"{n:03d}{ext}"
            if p.exists():
                return p
        return photos_dir / f"{n:03d}.jpg"

    hdr = rest_headers(service_key)

    if args.dry_run:
        print("Dry run: first 8 photo paths:")
        for i in range(8):
            print(i, MENU[i]["name"], "->", photo_path_for_dish(i))
        return

    # --- Только картинки: PATCH по sort_order, меню и UUID не пересоздаём ---
    if args.images_only:
        r = requests.get(
            f"{supabase_url}/rest/v1/products?shop_id=eq.{SHOP_ID}&select=id,name,sort_order&order=sort_order.asc",
            headers=hdr,
            timeout=60,
        )
        if r.status_code != 200:
            sys.exit(f"list products: {r.status_code} {r.text}")
        rows = r.json()
        if len(rows) != len(MENU):
            sys.exit(
                f"images-only: в БД {len(rows)} товаров, в MENU {len(MENU)} — сначала полный импорт без --images-only"
            )
        for idx, (item, row) in enumerate(zip(MENU, rows)):
            if row.get("name") != item["name"]:
                print(f"WARN idx {idx}: БД name={row.get('name')!r} != MENU {item['name']!r}", file=sys.stderr)
            ppath = photo_path_for_dish(idx)
            if not ppath.exists():
                sys.exit(f"Missing photo for dish {idx} {item['name']}: expected {ppath}")
            card_bytes = card_webp_from_file(ppath)
            hero_bytes = hero_webp_from_file(ppath)
            uid = uuid.uuid4().hex[:10]
            card_path = f"{SHOP_ID}/products/luna-dish-{idx:03d}-{uid}-card.webp"
            hero_path = f"{SHOP_ID}/products/luna-dish-{idx:03d}-{uid}-hero.webp"
            card_url = upload_object(supabase_url, service_key, card_path, card_bytes, "image/webp")
            hero_url = upload_object(supabase_url, service_key, hero_path, hero_bytes, "image/webp")
            combined = f"{card_url}|{hero_url}"
            pr = requests.patch(
                f"{supabase_url}/rest/v1/products?id=eq.{row['id']}",
                headers={**hdr, "Prefer": "return=minimal"},
                json={"image": combined},
                timeout=60,
            )
            if pr.status_code not in (200, 204):
                sys.exit(f"patch product {row['id']}: {pr.status_code} {pr.text}")
        print(f"Updated images for {len(rows)} products (images-only).")
        return

    # 1) Remove cross-sell links for shop
    r = requests.delete(
        f"{supabase_url}/rest/v1/cart_cross_sell_product_links?shop_id=eq.{SHOP_ID}",
        headers={**hdr, "Prefer": "return=minimal"},
        timeout=60,
    )
    if r.status_code not in (200, 204):
        print("WARN cross_sell delete:", r.status_code, r.text[:500])

    # 2) Delete products for shop
    r = requests.delete(
        f"{supabase_url}/rest/v1/products?shop_id=eq.{SHOP_ID}",
        headers={**hdr, "Prefer": "return=minimal"},
        timeout=120,
    )
    if r.status_code not in (200, 204):
        sys.exit(f"delete products: {r.status_code} {r.text}")

    # 3) Delete categories for shop
    r = requests.delete(
        f"{supabase_url}/rest/v1/categories?shop_id=eq.{SHOP_ID}",
        headers={**hdr, "Prefer": "return=minimal"},
        timeout=60,
    )
    if r.status_code not in (200, 204):
        sys.exit(f"delete categories: {r.status_code} {r.text}")

    # 4) Insert categories (sort_order by menu flow)
    cat_order = ["Завтраки", "Напитки", "Супы", "Горячее", "Салаты", "Выпечка", "Гарниры", "Десерты"]
    breakfast_windows = [{"days": [0, 1, 2, 3, 4, 5, 6], "start": "08:00", "end": "12:00"}]
    cat_rows = []
    for i, name in enumerate(cat_order):
        row = {
            "shop_id": SHOP_ID,
            "name": name,
            "sort_order": i * 10,
            "is_active": True,
            "availability_windows": breakfast_windows if name == "Завтраки" else [],
        }
        cat_rows.append(row)

    r = requests.post(
        f"{supabase_url}/rest/v1/categories",
        headers=hdr,
        json=cat_rows,
        timeout=60,
    )
    if r.status_code not in (200, 201):
        sys.exit(f"insert categories: {r.status_code} {r.text}")
    inserted_cats = r.json()
    cat_id_by_name = {c["name"]: c["id"] for c in inserted_cats}

    # 5) Upload hero images + insert products
    products_payload = []
    for idx, item in enumerate(MENU):
        ppath = photo_path_for_dish(idx)
        if not ppath.exists():
            sys.exit(f"Missing photo for dish {idx} {item['name']}: expected {ppath}")
        card_bytes = card_webp_from_file(ppath)
        hero_bytes = hero_webp_from_file(ppath)
        uid = uuid.uuid4().hex[:10]
        # Storage keys must be ASCII-only (Supabase object path).
        card_path = f"{SHOP_ID}/products/luna-dish-{idx:03d}-{uid}-card.webp"
        hero_path = f"{SHOP_ID}/products/luna-dish-{idx:03d}-{uid}-hero.webp"
        card_url = upload_object(supabase_url, service_key, card_path, card_bytes, "image/webp")
        hero_url = upload_object(supabase_url, service_key, hero_path, hero_bytes, "image/webp")
        combined = f"{card_url}|{hero_url}"

        cid = cat_id_by_name[item["cat"]]
        products_payload.append(
            {
                "shop_id": SHOP_ID,
                "name": item["name"],
                "price": item["price"],
                "image": combined,
                "description": item["desc"],
                "category_id": cid,
                "category": "migrated",
                "is_active": True,
                "sort_order": idx,
                "availability_windows": [],
            }
        )

    r = requests.post(
        f"{supabase_url}/rest/v1/products",
        headers=hdr,
        json=products_payload,
        timeout=120,
    )
    if r.status_code not in (200, 201):
        sys.exit(f"insert products: {r.status_code} {r.text}")

    # 6) Restaurant display name
    r = requests.patch(
        f"{supabase_url}/rest/v1/restaurants?id=eq.{RESTAURANT_ID}",
        headers={**hdr, "Prefer": "return=minimal"},
        json={"name": "Луна Лаундж бар"},
        timeout=30,
    )
    if r.status_code not in (200, 204):
        sys.exit(f"patch restaurant: {r.status_code} {r.text}")

    print(f"Imported {len(products_payload)} products, {len(cat_rows)} categories.")
    print("Restaurant name set to: Луна Лаундж бар")


if __name__ == "__main__":
    main()
