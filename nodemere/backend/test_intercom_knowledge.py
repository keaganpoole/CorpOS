import unittest
from unittest.mock import Mock, patch

from backend.intercom_knowledge import (
    GENERAL_DIR, GENERAL_FOLDERS, active_shared_documents, build_intercom_knowledge,
    cached_general_documents, render_documents, safe_general_override, sync_general_documents,
    sync_business_documents,
)


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
        with patch("backend.intercom_knowledge.sync_general_documents", return_value=("testing", shared)), patch(
            "backend.intercom_knowledge.sync_business_documents", return_value=tenant_doc
        ) as sync, patch("backend.intercom_knowledge.attach_documents_to_branch") as attach, patch(
            "backend.intercom_knowledge.safe_general_override", return_value=("testing", shared)
        ):
            attach.return_value = {"shared", "business-42"}
            branch, docs = build_intercom_knowledge(store, business, "key", "agent")
        self.assertEqual(branch, "testing")
        self.assertEqual([doc["id"] for doc in docs], ["shared", "business-42"])
        self.assertIs(sync.call_args.args[1], business)
        attach.assert_called_once_with("key", "agent", "testing", tenant_doc, http=__import__("requests"))

    def test_empty_elevenlabs_branch_is_bootstrapped_from_project_files(self):
        paths = [path for folder in GENERAL_FOLDERS for path in sorted((GENERAL_DIR / folder).glob("*.md"))]
        http = Mock()
        created = [Mock(json=Mock(return_value={"id": f"new-{index}"})) for index in range(len(paths))]
        for response in created:
            response.raise_for_status.return_value = None
        http.post.side_effect = created
        with patch("backend.intercom_knowledge.live_branch_configuration", return_value=("testing", {
            "conversation_config": {"agent": {"prompt": {"knowledge_base": []}}},
        })), patch("backend.intercom_knowledge.attach_documents_to_branch") as attach, patch(
            "backend.intercom_knowledge._general_cache", None
        ):
            branch, docs = sync_general_documents("key", "agent", http=http)
            self.assertEqual([row["id"] for row in cached_general_documents("agent")[1]], [row["id"] for row in docs])
        self.assertEqual(branch, "testing")
        self.assertEqual(len(docs), 15)
        self.assertEqual(http.post.call_count, 15)
        attach.assert_called_once()
        self.assertEqual(len(attach.call_args.args[3]), 15)

    def test_unchanged_general_files_are_not_uploaded_again(self):
        paths = [path for folder in GENERAL_FOLDERS for path in sorted((GENERAL_DIR / folder).glob("*.md"))]
        attached = [{"id": f"existing-{index}", "name": f"Nodemere — {path.parent.name} — {path.name}", "type": "file", "usage_mode": "prompt"} for index, path in enumerate(paths)]
        http = Mock()
        def get(url, **kwargs):
            response = Mock()
            response.raise_for_status.return_value = None
            if url.endswith("/source-file-url"):
                response.json.return_value = {"signed_url": f"source://{url.split('/')[-2]}"}
            else:
                index = int(url.removeprefix("source://existing-"))
                response.content = paths[index].read_bytes()
            return response
        http.get.side_effect = get
        with patch("backend.intercom_knowledge.live_branch_configuration", return_value=("testing", {
            "conversation_config": {"agent": {"prompt": {"knowledge_base": attached}}},
        })), patch("backend.intercom_knowledge._general_cache", None):
            _, docs = sync_general_documents("key", "agent", http=http)
        self.assertEqual([row["id"] for row in docs], [row["id"] for row in attached])
        http.patch.assert_not_called()
        http.post.assert_not_called()

    def test_changed_general_file_updates_existing_id_once(self):
        paths = [path for folder in GENERAL_FOLDERS for path in sorted((GENERAL_DIR / folder).glob("*.md"))]
        attached = [{"id": f"existing-{index}", "name": f"Nodemere — {path.parent.name} — {path.name}", "type": "file"} for index, path in enumerate(paths)]
        http = Mock()
        def get(url, **kwargs):
            response = Mock()
            response.raise_for_status.return_value = None
            if url.endswith("/source-file-url"):
                response.json.return_value = {"signed_url": f"source://{url.split('/')[-2]}"}
            else:
                index = int(url.removeprefix("source://existing-"))
                response.content = b"older version" if index == 0 else paths[index].read_bytes()
            return response
        http.get.side_effect = get
        http.patch.return_value.json.return_value = {"id": "existing-0"}
        with patch("backend.intercom_knowledge.live_branch_configuration", return_value=("testing", {
            "conversation_config": {"agent": {"prompt": {"knowledge_base": attached}}},
        })), patch("backend.intercom_knowledge._general_cache", None):
            _, docs = sync_general_documents("key", "agent", http=http)
        self.assertEqual([row["id"] for row in docs], [row["id"] for row in attached])
        self.assertEqual(http.patch.call_count, 1)
        self.assertIn("existing-0/update-file", http.patch.call_args.args[0])
        http.post.assert_not_called()

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
        self.assertEqual(table.upsert.call_args.args[0]["elevenlabs_document_id"], "replacement")

    def test_safe_fallback_rebuilds_if_general_ids_are_detached(self):
        shared = [{"id": "stale", "name": "Nodemere — 05 — guide"}]
        with patch("backend.intercom_knowledge._general_cache", ("agent", "testing", shared)), patch(
            "backend.intercom_knowledge.live_branch_configuration", return_value=("testing", {
                "conversation_config": {"agent": {"prompt": {"knowledge_base": [{"id": "business-other"}]}}},
            })
        ), patch("backend.intercom_knowledge.sync_general_documents", return_value=("testing", [{"id": "new"}])) as sync:
            _, docs = safe_general_override("key", "agent")
        self.assertEqual([row["id"] for row in docs], ["new"])
        sync.assert_called_once()


if __name__ == "__main__":
    unittest.main()
