import re

from ensheet.pipeline import _flatten_text

# Verovio 6.4.1 page-2 header, trimmed
HEADER = (
    '<text font-size="0px"> <tspan class="rend" x="10000" y="219" text-anchor="middle">'
    '<tspan class="text"><tspan font-size="324px">– </tspan></tspan>'
    '<tspan class="num"><title class="labelAttr">page</title>'
    '<tspan class="text"><tspan font-size="324px">2</tspan></tspan></tspan>'
    '<tspan class="text"><tspan font-size="324px"> –</tspan></tspan></tspan></text>'
)


def test_flatten_text_merges_header_into_one_positioned_string():
    out = re.sub(r"<text [^>]*>\s*<tspan [^>]*\bx=.*?</text>", _flatten_text, HEADER, flags=re.S)
    assert out == '<text x="10000" y="219" text-anchor="middle" font-size="324px">– 2 –</text>'
