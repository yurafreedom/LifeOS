"""Leaf: the minimum TrueType reading and subsetting the PDF writer needs.

The PDF export embeds DejaVu Sans so Cyrillic renders and extracts everywhere,
without a PDF dependency. The whole font is ~750 KB, so each PDF gets a subset:
glyph ids stay stable (the PDF uses ``CIDToGIDMap /Identity``) but every glyph
the report does not use — directly or as a composite component — has its
outline emptied. Only the tables a PDF viewer needs for an embedded
CIDFontType2 are kept, with checksums and ``checkSumAdjustment`` recomputed.
"""

import struct
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

FONTS_DIR = Path(__file__).with_name("fonts")
_REQUIRED = ("head", "hhea", "maxp", "hmtx", "loca", "glyf")
_KEPT = ("head", "hhea", "maxp", "loca", "glyf", "hmtx", "cvt ", "fpgm", "prep")

# Composite glyph component flags (glyf spec).
_ARG_WORDS = 0x0001
_HAVE_SCALE = 0x0008
_MORE_COMPONENTS = 0x0020
_HAVE_XY_SCALE = 0x0040
_HAVE_2X2 = 0x0080


def _checksum(data: bytes) -> int:
    padded = data + b"\0" * (-len(data) % 4)
    return sum(struct.unpack(f">{len(padded) // 4}I", padded)) & 0xFFFFFFFF


@dataclass(frozen=True, slots=True)
class FontMetrics:
    units_per_em: int
    ascent: int
    descent: int
    cap_height: int
    bbox: tuple[int, int, int, int]
    italic_angle: float


class TrueTypeFont:
    def __init__(self, data: bytes, name: str) -> None:
        self.data = data
        self.name = name
        (num_tables,) = struct.unpack_from(">H", data, 4)
        self.tables: dict[str, tuple[int, int]] = {}
        for i in range(num_tables):
            tag, _, offset, length = struct.unpack_from(">4sIII", data, 12 + 16 * i)
            self.tables[tag.decode("latin-1")] = (offset, length)
        missing = [tag for tag in _REQUIRED if tag not in self.tables]
        if missing:
            raise ValueError(f"font {name} lacks tables: {missing}")

        head = self.table("head")
        units_per_em = struct.unpack_from(">H", head, 18)[0]
        bbox = struct.unpack_from(">hhhh", head, 36)
        self._long_loca = struct.unpack_from(">h", head, 50)[0] == 1
        hhea = self.table("hhea")
        ascent, descent = struct.unpack_from(">hh", hhea, 4)
        num_h_metrics = struct.unpack_from(">H", hhea, 34)[0]
        self.num_glyphs = struct.unpack_from(">H", self.table("maxp"), 4)[0]

        cap_height = ascent
        if "OS/2" in self.tables:
            os2 = self.table("OS/2")
            version = struct.unpack_from(">H", os2, 0)[0]
            if version >= 2 and len(os2) >= 90:
                cap_height = struct.unpack_from(">h", os2, 88)[0]
        italic_angle = 0.0
        if "post" in self.tables:
            italic_angle = struct.unpack_from(">i", self.table("post"), 4)[0] / 65536
        self.metrics = FontMetrics(units_per_em, ascent, descent, cap_height, bbox, italic_angle)

        hmtx = self.table("hmtx")
        advances = [struct.unpack_from(">H", hmtx, 4 * i)[0] for i in range(num_h_metrics)]
        advances += [advances[-1]] * (self.num_glyphs - num_h_metrics)
        self.advances = advances
        self.cmap = self._read_cmap()
        self._loca = self._read_loca()

    def table(self, tag: str) -> bytes:
        offset, length = self.tables[tag]
        return self.data[offset : offset + length]

    def glyph_id(self, codepoint: int) -> int:
        return self.cmap.get(codepoint, 0)

    def advance(self, gid: int) -> int:
        return self.advances[gid] if gid < len(self.advances) else 0

    def _read_cmap(self) -> dict[int, int]:
        cmap = self.table("cmap")
        (count,) = struct.unpack_from(">H", cmap, 2)
        candidates: dict[tuple[int, int], int] = {}
        for i in range(count):
            platform, encoding, offset = struct.unpack_from(">HHI", cmap, 4 + 8 * i)
            fmt = struct.unpack_from(">H", cmap, offset)[0]
            candidates[(fmt, platform * 100 + encoding)] = offset
        for key in ((12, 310), (12, 4), (12, 3), (4, 301), (4, 3), (4, 1), (4, 0)):
            if key in candidates:
                offset = candidates[key]
                return self._cmap12(cmap, offset) if key[0] == 12 else self._cmap4(cmap, offset)
        raise ValueError(f"font {self.name} has no Unicode cmap")

    @staticmethod
    def _cmap4(cmap: bytes, offset: int) -> dict[int, int]:
        seg_count = struct.unpack_from(">H", cmap, offset + 6)[0] // 2
        ends_at = offset + 14
        starts_at = ends_at + 2 * seg_count + 2
        deltas_at = starts_at + 2 * seg_count
        ranges_at = deltas_at + 2 * seg_count
        ends = struct.unpack_from(f">{seg_count}H", cmap, ends_at)
        starts = struct.unpack_from(f">{seg_count}H", cmap, starts_at)
        deltas = struct.unpack_from(f">{seg_count}h", cmap, deltas_at)
        ranges = struct.unpack_from(f">{seg_count}H", cmap, ranges_at)
        mapping: dict[int, int] = {}
        for seg in range(seg_count):
            start, end, delta, range_offset = starts[seg], ends[seg], deltas[seg], ranges[seg]
            if start == 0xFFFF:
                continue
            for code in range(start, end + 1):
                if range_offset == 0:
                    gid = (code + delta) & 0xFFFF
                else:
                    at = ranges_at + 2 * seg + range_offset + 2 * (code - start)
                    gid = struct.unpack_from(">H", cmap, at)[0]
                    if gid:
                        gid = (gid + delta) & 0xFFFF
                if gid:
                    mapping[code] = gid
        return mapping

    @staticmethod
    def _cmap12(cmap: bytes, offset: int) -> dict[int, int]:
        (groups,) = struct.unpack_from(">I", cmap, offset + 12)
        mapping: dict[int, int] = {}
        for i in range(groups):
            start, end, first_gid = struct.unpack_from(">III", cmap, offset + 16 + 12 * i)
            for code in range(start, end + 1):
                mapping[code] = first_gid + code - start
        return mapping

    def _read_loca(self) -> list[int]:
        loca = self.table("loca")
        count = self.num_glyphs + 1
        if self._long_loca:
            return list(struct.unpack_from(f">{count}I", loca))
        return [value * 2 for value in struct.unpack_from(f">{count}H", loca)]

    def _glyph(self, gid: int) -> bytes:
        glyf_offset, _ = self.tables["glyf"]
        start, end = self._loca[gid], self._loca[gid + 1]
        return self.data[glyf_offset + start : glyf_offset + end]

    def _components(self, glyph: bytes) -> list[int]:
        if len(glyph) < 10 or struct.unpack_from(">h", glyph, 0)[0] >= 0:
            return []
        components: list[int] = []
        at = 10
        while True:
            flags, gid = struct.unpack_from(">HH", glyph, at)
            components.append(gid)
            at += 4 + (4 if flags & _ARG_WORDS else 2)
            if flags & _HAVE_SCALE:
                at += 2
            elif flags & _HAVE_XY_SCALE:
                at += 4
            elif flags & _HAVE_2X2:
                at += 8
            if not flags & _MORE_COMPONENTS:
                return components

    def _closure(self, gids: set[int]) -> set[int]:
        keep: set[int] = set()
        pending = [0, *(gid for gid in gids if 0 <= gid < self.num_glyphs)]
        while pending:
            gid = pending.pop()
            if gid in keep:
                continue
            keep.add(gid)
            pending.extend(
                c for c in self._components(self._glyph(gid))
                if c not in keep and c < self.num_glyphs
            )
        return keep

    def subset(self, gids: set[int]) -> bytes:
        """A font program with the same glyph ids whose unused outlines are empty."""
        keep = self._closure(gids)
        glyf = bytearray()
        loca: list[int] = []
        for gid in range(self.num_glyphs):
            loca.append(len(glyf))
            if gid in keep:
                glyph = self._glyph(gid)
                glyf += glyph + b"\0" * (-len(glyph) % 4)
        loca.append(len(glyf))

        head = bytearray(self.table("head"))
        struct.pack_into(">I", head, 8, 0)
        struct.pack_into(">h", head, 50, 1)
        tables = {
            "head": bytes(head),
            "loca": struct.pack(f">{len(loca)}I", *loca),
            "glyf": bytes(glyf),
        }
        for tag in _KEPT:
            if tag not in tables and tag in self.tables:
                tables[tag] = self.table(tag)
        return _assemble(tables)


def _assemble(tables: dict[str, bytes]) -> bytes:
    tags = sorted(tables)
    count = len(tags)
    power = 1
    while power * 2 <= count:
        power *= 2
    header = struct.pack(">IHHHH", 0x00010000, count, power * 16, power.bit_length() - 1,
                         count * 16 - power * 16)
    offset = 12 + 16 * count
    directory = bytearray()
    body = bytearray()
    head_at = 0
    for tag in tags:
        data = tables[tag]
        if tag == "head":
            head_at = offset + len(body)
        directory += struct.pack(">4sIII", tag.encode("latin-1"), _checksum(data),
                                 offset + len(body), len(data))
        body += data + b"\0" * (-len(data) % 4)
    font = bytearray(header + directory + body)
    adjustment = (0xB1B0AFBA - _checksum(bytes(font))) & 0xFFFFFFFF
    struct.pack_into(">I", font, head_at + 8, adjustment)
    return bytes(font)


@lru_cache(maxsize=4)
def load_font(filename: str) -> TrueTypeFont:
    """A bundled font from ``fonts/``, parsed once per process."""
    return TrueTypeFont((FONTS_DIR / filename).read_bytes(), filename)
