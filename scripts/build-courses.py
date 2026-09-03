#!/usr/bin/env python3
"""Build assets/courses.js from SCORM manifests and module folders."""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRADES = [f"ru-{n}" for n in range(2, 12)]

GROUP_ORDER = {
    "Грамматика": 1,
    "Новые слова": 2,
    "Развитие речи": 3,
    "Проверка": 4,
    "Другое": 9,
}


def local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def text(el) -> str:
    if el is None:
        return ""
    return (el.text or "").strip()


def module_titles(manifest: Path) -> list[str]:
    tree = ET.parse(manifest)
    org = None
    for el in tree.getroot().iter():
        if local(el.tag) == "organization":
            org = el
            break
    if org is None:
        return []
    titles = []
    for child in list(org):
        if local(child.tag) == "item":
            for sub in list(child):
                if local(sub.tag) == "title":
                    titles.append(text(sub))
                    break
    return titles


def lesson_meta(filename: str):
    name = filename.lower()
    if not re.match(r"^[a-z0-9_.-]+\.(htm|html)$", name):
        return None
    num_match = re.search(r"(\d+)", name)
    num = int(num_match.group(1)) if num_match else 1
    if name.startswith("grammar_rules"):
        return "Грамматика", "Правила", 0
    if name.startswith("grammar_ex"):
        return "Грамматика", f"Упражнение {num}", num
    if name.startswith("vocabulary_new_words"):
        label = "Читай и учи" if num == 1 else f"Читай и учи {num}"
        return "Новые слова", label, num
    if name.startswith("vocabulary_exercises"):
        return "Новые слова", f"Упражнения {num}", 100 + num
    if name.startswith("texts_read"):
        return "Развитие речи", "Чтение", 1
    if name.startswith("texts_listen"):
        return "Развитие речи", "Аудирование", 2
    if name.startswith("dialog"):
        return "Развитие речи", "Диалог", 3
    if "test" in name:
        return "Проверка", "Итоговый тест", 1
    return None


def content_root(grade_dir: Path) -> Path:
    for name in ("russian_2", "russian_6", "russian_7"):
        candidate = grade_dir / "common" / name
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(f"No content folder in {grade_dir}")


def collect_modules(grade_id: str) -> dict:
    grade_dir = ROOT / grade_id
    titles = module_titles(grade_dir / "imsmanifest.xml")
    content = content_root(grade_dir)
    folders = sorted(
        [p for p in content.glob("module_*") if p.is_dir()],
        key=lambda p: int(re.search(r"\d+", p.name).group()),
    )
    modules = []
    for i, folder in enumerate(folders):
        title = titles[i] if i < len(titles) else folder.name.replace("_", " ").title()
        grouped: dict[str, list] = {}
        for html in folder.iterdir():
            if html.suffix.lower() not in {".htm", ".html"}:
                continue
            meta = lesson_meta(html.name)
            if not meta:
                continue
            group, name, order = meta
            rel = html.relative_to(grade_dir).as_posix()
            grouped.setdefault(group, []).append(
                {"name": name, "href": rel, "order": order}
            )
        lessons = []
        for group in sorted(grouped, key=lambda g: GROUP_ORDER.get(g, 8)):
            items = sorted(grouped[group], key=lambda x: (x["order"], x["name"]))
            lessons.append(
                {
                    "group": group,
                    "items": [{"name": x["name"], "href": x["href"]} for x in items],
                }
            )
        modules.append({"title": title, "lessons": lessons})
    grade_num = int(grade_id.split("-")[1])
    return {
        "id": grade_id,
        "grade": grade_num,
        "title": f"Русский язык, {grade_num} класс",
        "kk": f"Орыс тілі, {grade_num}-сынып",
        "folder": grade_id,
        "modules": modules,
    }


def main() -> None:
    courses = [collect_modules(grade) for grade in GRADES]
    out = ROOT / "assets" / "courses.js"
    payload = json.dumps(courses, ensure_ascii=False, indent=2)
    out.write_text(f"window.COURSES = {payload};\n", encoding="utf-8")
    lessons = sum(
        len(item["href"]) > 0
        for c in courses
        for m in c["modules"]
        for g in m["lessons"]
        for item in g["items"]
    )
    print(f"Wrote {out} — {len(courses)} grades, {lessons} lessons")


if __name__ == "__main__":
    main()
