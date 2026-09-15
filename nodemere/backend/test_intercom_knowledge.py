import unittest
from unittest.mock import Mock, patch

from backend.intercom_knowledge import active_shared_documents, build_intercom_knowledge, render_documents


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
            {"name": "Consultation", "is_active": True, "price_type": "starting_at", "price_min": 50, "unit": "session"},
            {"name": "Old Service", "is_active": False, "price_type": "fixed", "price_min": 90},
        ]
        staff = [
            {"full_name": "Sam", "is_active": True, "role": "Specialist", "knowledge": "Works with new clients"},
            {"full_name": "Taylor", "is_active": False, "role": "Specialist"},
        ]
        docs = render_documents(business, services, staff)
        self.assertEqual(set(docs), {"policies", "services", "staff", "about", "faq", "hours"})
        self.assertIn("From $50 per session", docs["services"])
        self.assertNotIn("Old Service", docs["services"])
        self.assertNotIn("duration", docs["services"].lower())  # No duration column exists in services.
        self.assertIn("Sam", docs["staff"])
        self.assertNotIn("Taylor", docs["staff"])
        self.assertIn("Monday: 09:00–17:00", docs["hours"])
        self.assertIn("Tuesday: Closed", docs["hours"])

    def test_override_uses_only_shared_docs_from_fully_live_branch(self):
        branches = Mock()
        branches.raise_for_status.return_value = None
        branches.json.return_value = {"results": [
            {"id": "main", "current_live_percentage": 0},
            {"id": "testing", "current_live_percentage": 100},
        ]}
        agent = Mock()
        agent.raise_for_status.return_value = None
        agent.json.return_value = {
            "conversation_config": {"agent": {"prompt": {"knowledge_base": [
                {"id": "shared", "name": "Nodemere — 05_ERROR_AND_RECOVERY — when_not_to_guess.md", "type": "file"},
                {"id": "other-business", "name": "Another business — policies.md", "type": "text"},
            ]}}},
            "platform_settings": {"overrides": {"conversation_config_override": {"agent": {"prompt": {"knowledge_base": True}}}}},
        }
        http = Mock()
        http.get.side_effect = [branches, agent]
        branch_id, docs = active_shared_documents("test-key", "test-agent", http=http)
        self.assertEqual(branch_id, "testing")
        self.assertEqual([doc["id"] for doc in docs], ["shared"])
        self.assertEqual(http.get.call_args.kwargs["params"], {"branch_id": "testing"})

    def test_no_sync_when_private_cache_migration_is_missing(self):
        store = Mock()
        store.rpc.return_value.execute.return_value.data = False
        http = Mock()
        with self.assertRaises(ValueError):
            build_intercom_knowledge(store, {"id": 42}, "test-key", "agent", http=http)
        http.get.assert_not_called()
        http.post.assert_not_called()

    def test_complete_override_contains_shared_then_only_selected_business(self):
        store = Mock()
        store.rpc.return_value.execute.return_value.data = True
        business = {"id": 42}
        shared = [{"id": "shared", "type": "file", "name": "Nodemere — 05 — guide"}]
        tenant_doc = [{"id": "business-42", "type": "text", "name": "Business 42 policies"}]
        with patch("backend.intercom_knowledge.active_shared_documents", return_value=("testing", shared)), patch(
            "backend.intercom_knowledge.sync_business_documents", return_value=tenant_doc
        ) as sync:
            branch, docs = build_intercom_knowledge(store, business, "key", "agent")
        self.assertEqual(branch, "testing")
        self.assertEqual([doc["id"] for doc in docs], ["shared", "business-42"])
        self.assertIs(sync.call_args.args[1], business)


if __name__ == "__main__":
    unittest.main()
