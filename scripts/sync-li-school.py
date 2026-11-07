"""Import the reviewed 李校来啦 ledger, handouts and printable book into the web app."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

DEST = Path(__file__).resolve().parents[1] / "content" / "li-school"
LEDGER = Path("单词表数据/课程.json")


def pdf_path(name):
    path = Path(name)
    if path.is_absolute() or ".." in path.parts or path.suffix.lower() != ".pdf":
        raise ValueError(f"无效的 PDF 相对路径：{name}")
    return path


def read_pdf(path):
    data = path.read_bytes()
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
        raise ValueError(f"PDF 文件为空或缺少完整的首尾标记：{path}")
    return data


def write_if_changed(path, data):
    if path.exists() and path.read_bytes() == data:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
    os.chmod(tmp.name, 0o644)
    os.replace(tmp.name, path)


def sync(source):
    raw = (source / LEDGER).read_bytes()
    book = json.loads(raw)
    if book.get("version") != 1 or not book.get("lessons"):
        raise ValueError("课程底稿缺少课次或版本不受支持")
    files = {}
    for lesson in book["lessons"]:
        if not lesson["rows"] or not lesson["sources"]:
            raise ValueError(f"课程资料不完整：{lesson['date']}")
        for name, expected in lesson["sources"].items():
            relative = pdf_path(name)
            data = read_pdf(source / relative)
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError(f"讲义与已核对的底稿不一致：{name}")
            files[relative] = data
    printable = pdf_path(book["output"])
    if printable in files:
        raise ValueError("整本复习表不能与原始讲义同名")
    files[printable] = read_pdf(source / printable)
    # Verify all source files before replacing content, then publish the ledger last.
    for relative, data in files.items():
        write_if_changed(DEST / relative, data)
    write_if_changed(DEST / LEDGER, raw)
    print(f"{len(book['lessons'])} 个课次，{len(files)-1} 份原始讲义，1 份整本复习表")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="含单词表数据/课程.json 的学习项目目录")
    sync(parser.parse_args().source)
