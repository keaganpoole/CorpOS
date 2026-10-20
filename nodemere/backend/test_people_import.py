import io
import json
import unittest

from openpyxl import Workbook

from .people_import import identity_keys, normalize_import_record, parse_people_import, prepare_people_import, row_import_key


class PeopleImportTests(unittest.TestCase):
    def test_csv_trims_headers_and_preserves_phone(self):
        parsed = parse_people_import(b" First Name ,Phone\nAva,02075550141\n", "people.csv")
        self.assertEqual(parsed["headers"], ["First Name", "Phone"])
        self.assertEqual(parsed["rows"][0]["values"], {"First Name": "Ava", "Phone": "02075550141"})

    def test_excel_reads_first_sheet(self):
        workbook = Workbook()
        workbook.active.append(["Name", "Email"])
        workbook.active.append(["Ada Lovelace", "ada@example.com"])
        content = io.BytesIO()
        workbook.save(content)
        parsed = parse_people_import(content.getvalue(), "people.xlsx")
        self.assertEqual(parsed["rows"][0]["values"]["Name"], "Ada Lovelace")

    def test_json_flattens_only_custom_fields(self):
        content = json.dumps({"people": [{"first_name": "Ada", "custom_fields": {
            "custom_vip": True, "email": "should-not-be-mapped@example.com",
        }}]}).encode()
        parsed = parse_people_import(content, "people.json")
        self.assertEqual(parsed["rows"][0]["values"], {"first_name": "Ada", "custom_vip": True})

    def test_identity_keys_and_import_key_are_stable(self):
        self.assertEqual(identity_keys({"email": " A@Example.com ", "phone": "+1 (207) 555-0144"}),
                         ["email:a@example.com", "phone:2075550144"])
        file_hash = "a" * 64
        self.assertEqual(row_import_key(file_hash, 2), row_import_key(file_hash, 2))
        self.assertNotEqual(row_import_key(file_hash, 2), row_import_key(file_hash, 3))

    def test_consent_requires_evidence(self):
        with self.assertRaisesRegex(ValueError, "Documented consent"):
            normalize_import_record({"first_name": "Ada", "consent_sms": "yes"},
                                    {"first_name": "text", "consent_sms": "boolean"})

    def test_existing_and_in_file_duplicates_are_skipped_without_updates(self):
        rows = [
            {"line": 2, "values": {"first_name": "Existing", "email": "known@example.com"}},
            {"line": 3, "values": {"first_name": "New", "email": "new@example.com"}},
            {"line": 4, "values": {"first_name": "Repeated", "email": "NEW@example.com"}},
        ]
        decisions, prepared = prepare_people_import(rows, "a" * 64,
            {"first_name": "text", "email": "text"}, "owner", 7,
            {"email:known@example.com"}, set())
        self.assertEqual([item["status"] for item in decisions], ["duplicate", "ready", "duplicate"])
        self.assertEqual(len(prepared), 1)
        self.assertEqual(prepared[0]["email"], "new@example.com")
        self.assertEqual(prepared[0]["business_id"], 7)

    def test_reimport_of_name_only_row_is_skipped_by_marker(self):
        file_hash = "b" * 64
        marker = row_import_key(file_hash, 2)
        decisions, prepared = prepare_people_import(
            [{"line": 2, "values": {"first_name": "Ada"}}], file_hash,
            {"first_name": "text"}, "owner", 7, set(), {marker})
        self.assertEqual(decisions[0]["status"], "duplicate")
        self.assertEqual(prepared, [])


if __name__ == "__main__":
    unittest.main()
