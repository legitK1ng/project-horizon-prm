import unittest
from datetime import datetime
from utils.naming import parse_filename, build_canonical_name, normalize_phone

class TestNaming(unittest.TestCase):
    def test_normalize_phone(self):
        self.assertEqual(normalize_phone("5551234567"), "+15551234567")
        self.assertEqual(normalize_phone("15551234567"), "+15551234567")
        self.assertEqual(normalize_phone("+15551234567"), "+15551234567")
        self.assertEqual(normalize_phone("invalid"), "")

    def test_pattern_t(self):
        # +15551234567-9000-1619654400000.m4a (Unix ms: 1619654400000 = 2021-04-29 00:00:00 UTC)
        filename = "+15551234567-9000-1619654400000.m4a"
        parsed = parse_filename(filename)
        self.assertEqual(parsed["pattern"], "T")
        self.assertEqual(parsed["phone"], "+15551234567")
        self.assertEqual(parsed["datetime"], "2021-04-29_000000")

    def test_pattern_h(self):
        # John Doe (+15551234567) [2022-01-01 12-00-00] [Incoming].mp3
        filename = "John Doe (+15551234567) [2022-01-01 12-00-00] [Incoming].mp3"
        parsed = parse_filename(filename)
        self.assertEqual(parsed["pattern"], "H")
        self.assertEqual(parsed["contact"], "John Doe")
        self.assertEqual(parsed["phone"], "+15551234567")
        self.assertEqual(parsed["direction"], "IN")
        self.assertEqual(parsed["datetime"], "2022-01-01_120000")

    def test_pattern_ef(self):
        # Jane_Doe_15557654321_2023_05_20_15_30_45.m4a
        filename = "Jane_Doe_15557654321_2023_05_20_15_30_45.m4a"
        parsed = parse_filename(filename)
        self.assertEqual(parsed["pattern"], "E")
        self.assertEqual(parsed["contact"], "Jane Doe")
        self.assertEqual(parsed["phone"], "+15557654321")
        self.assertEqual(parsed["datetime"], "2023-05-20_153045")

    def test_pattern_z(self):
        # 2021-12-25 18-00-00 (phone) Mom (+15551112222) ↗.amr
        filename = "2021-12-25 18-00-00 (phone) Mom (+15551112222) ↗.amr"
        parsed = parse_filename(filename)
        self.assertEqual(parsed["pattern"], "Z")
        self.assertEqual(parsed["contact"], "Mom")
        self.assertEqual(parsed["phone"], "+15551112222")
        self.assertEqual(parsed["direction"], "OUT")
        self.assertEqual(parsed["datetime"], "2021-12-25_180000")

    def test_pattern_a(self):
        # Alice (+15559998888) ↙ (phone) 2023-10-10 10-10-10.mp3
        filename = "Alice (+15559998888) ↙ (phone) 2023-10-10 10-10-10.mp3"
        parsed = parse_filename(filename)
        self.assertEqual(parsed["pattern"], "A")
        self.assertEqual(parsed["contact"], "Alice")
        self.assertEqual(parsed["phone"], "+15559998888")
        self.assertEqual(parsed["direction"], "IN")
        self.assertEqual(parsed["datetime"], "2023-10-10_101010")

    def test_build_canonical(self):
        parsed = {
            "datetime": "2023-01-01_120000",
            "direction": "IN",
            "phone": "+15550001111",
            "contact": "John Smith",
            "channel_idx": "1"
        }
        name = build_canonical_name(parsed, ".m4a")
        self.assertEqual(name, "2023-01-01_120000_IN_+15550001111_john-smith_ch1.m4a")

if __name__ == '__main__':
    unittest.main()
