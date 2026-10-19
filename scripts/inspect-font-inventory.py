#!/usr/bin/env python3
"""Inspect an officially acquired TTF/OTF font and its bundled license receipt."""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True, type=Path)
parser.add_argument('--license', required=True, type=Path)
parser.add_argument('--sample', default='한글 타이포 2026 ₩→뷁')
args = parser.parse_args()
font = TTFont(args.font)
names = font['name'].names

def name(*ids):
    for ident in ids:
        for record in names:
            if record.nameID == ident:
                try:
                    return record.toUnicode()
                except Exception:
                    pass

cmap = set().union(*(set(table.cmap) for table in font['cmap'].tables if table.isUnicode()))
axes = {}
if 'fvar' in font:
    axes = {axis.axisTag: {'min': axis.minValue, 'default': axis.defaultValue, 'max': axis.maxValue} for axis in font['fvar'].axes}
missing = sorted({character for character in args.sample if not character.isspace() and ord(character) not in cmap})
license_bytes = args.license.read_bytes()
print(json.dumps({
    'font_file': args.font.name,
    'font_sha256': hashlib.sha256(args.font.read_bytes()).hexdigest(),
    'family': name(16, 1),
    'face': name(4, 6),
    'font_version': name(5),
    'os2_weight_class': font['OS/2'].usWeightClass,
    'axes': axes,
    'unicode_codepoints': len(cmap),
    'coverage_sample': args.sample,
    'missing_codepoints': missing,
    'license_file': args.license.name,
    'license_sha256': hashlib.sha256(license_bytes).hexdigest(),
    'license_is_ofl_1_1': b'SIL OPEN FONT LICENSE Version 1.1' in license_bytes,
}, ensure_ascii=False, indent=2))
