from music21 import note

from ensheet.pipeline import quantize


def test_quantize_snaps_and_splits_hands():
    # bpm 60 => 1 second = 1 quarter; sixteenth grid = 0.25
    notes = [
        (0.02, 0.48, 72, 0.8),  # RH, snaps to 0.0-0.5
        (0.51, 0.53, 64, 0.5),  # RH, too short -> min one step
        (0.0, 1.97, 48, 0.6),   # LH, 0.0-2.0
        (0.0, 1.0, 43, 0.6),    # LH, same onset -> chord
    ]
    score = quantize(notes, bpm=60)
    right_hand, left_hand = score.parts
    right_hand_notes = list(right_hand.flatten().notes)
    left_hand_notes = list(left_hand.flatten().notes)

    assert [(played.offset, played.quarterLength, played.pitch.midi) for played in right_hand_notes] == [(0.0, 0.5, 72), (0.5, 0.25, 64)]
    assert len(left_hand_notes) == 1 and [pitch.midi for pitch in left_hand_notes[0].pitches] == [43, 48]
    assert left_hand_notes[0].quarterLength == 2.0
    assert all(pitch.midi >= 60 for played in right_hand_notes for pitch in played.pitches)
