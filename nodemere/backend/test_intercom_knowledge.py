import unittest
from unittest.mock import Mock, patch

from backend.intercom_knowledge import build_intercom_knowledge, render_documents, sync_business_documents


class IntercomKnowledgeTests(unittest.TestCase):
    def test_render_uses_only_active_service_and_staff_facts(self):
        business = {
            "id": 42, "name": "Example", "policies": "Payment due on arrival.",
            "about_us": "A local team.", "faq": "Do you take walk-ins? Ask us first.",
            "business_timezone": "America/New_York",
            "business_hours": {"schema_version": 1, "days": {
                "Monday": {"enabled": True, "layers": {"business": {"enabled": True, "start": 9, "end": 17}}},
                "Tuesday": {"enabled": False, "layers": {"business": {"enabled": True, "start": 9, "end": 17}}},
            }},
        }
        services = [
            {"id": "11111111-1111-4111-8111-111111111111", "name": "Consultation", "is_active": True, "price_type": "starting_at", "price_min": 50, "unit": "session"},
            {"name": "Old Service", "is_active": False, "price_type": "fixed", "price_min": 90},
        ]
        staff = [
            {"id": "22222222-2222-4222-8222-222222222222", "full_name": "Sam", "is_active": True, "role": "Specialist", "knowledge": "Works with new clients",
             "working_hours": {"Monday": {"open": "09:00", "close": "17:00"}}},
            {"full_name": "Taylor", "is_active": False, "role": "Specialist"},
        ]
        docs = render_documents(business, services, staff)
        self.assertEqual(set(docs), {"policies", "services", "staff", "about", "faq", "hours", "receptionist_stories"})
        self.assertIn("Service ID: 11111111-1111-4111-8111-111111111111", docs["services"])
        self.assertIn("From $50 per session", docs["services"])
        self.assertNotIn("Old Service", docs["services"])
        self.assertNotIn("duration", docs["services"].lower())
        self.assertIn("Sam", docs["staff"])
        self.assertIn("Staff ID: 22222222-2222-4222-8222-222222222222", docs["staff"])
        self.assertIn("Monday: 09:00–17:00", docs["staff"])
        self.assertNotIn("Taylor", docs["staff"])
        self.assertIn("Monday: 09:00–17:00", docs["hours"])
        self.assertIn("Tuesday: Closed", docs["hours"])

    def test_complete_override_contains_only_selected_business(self):
        store = Mock()
        business = {"id": 42}
        tenant_doc = [{"id": "business-42", "type": "text", "name": "Business 42 policies"}]
        with patch("backend.intercom_knowledge.live_branch_configuration", return_value=("testing", {})), patch(
            "backend.intercom_knowledge.sync_business_documents", return_value=tenant_doc
        ) as sync, patch("backend.intercom_knowledge.attach_documents_to_branch") as attach:
            branch, docs = build_intercom_knowledge(store, business, "key", "agent")
        self.assertEqual(branch, "testing")
        self.assertEqual([doc["id"] for doc in docs], ["business-42"])
        self.assertIs(sync.call_args.args[1], business)
        attach.assert_called_once_with("key", "agent", "testing", tenant_doc, http=__import__("requests"))

    def test_deleted_dynamic_id_is_recreated_and_saved(self):
        store = Mock()
        table = store.table.return_value
        table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        table.select.return_value.eq.return_value.execute.return_value.data = [{
            "id": 7, "document_type": "policies", "content": "# Example — Policies\nCurrent policy",
            "version": 1, "elevenlabs_document_id": "deleted", "published": True,
        }]
        http = Mock()
        http.get.return_value.status_code = 404
        http.post.return_value.json.return_value = {"id": "replacement"}
        with patch("backend.intercom_knowledge.render_documents", return_value={
            "policies": "# Example — Policies\nCurrent policy",
        }), patch("backend.intercom_knowledge._validated_business_ids", set()):
            refs = sync_business_documents(store, {"id": 42}, "key", http=http)
        self.assertEqual([row["id"] for row in refs], ["replacement"])
        self.assertEqual([call.args[0] for call in store.table.call_args_list], ["services", "staff"])


if __name__ == "__main__":
    unittest.main()
