"""Offline regressions for provisioning a receptionist number without forwarding."""

import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

from backend import main


class DirectLineProvisioningTests(unittest.TestCase):
    def test_successful_import_assigns_inbound_agent(self):
        with (
            patch.object(main, "elevenlabs_agent_id_inbound", "inbound-agent"),
            patch.object(main, "find_elevenlabs_phone_number", return_value=None),
            patch.object(main, "import_elevenlabs_phone_number", return_value="new-phone-id"),
            patch.object(main, "assign_elevenlabs_phone_number_to_inbound_agent", return_value=True) as assign,
        ):
            result = main.prepare_elevenlabs_phone_number_for_business("+12025550112", "Test line")

        self.assertEqual(result, "new-phone-id")
        assign.assert_called_once_with("new-phone-id")

    def test_import_requires_successful_inbound_agent_assignment(self):
        with (
            patch.object(main, "elevenlabs_agent_id_inbound", "inbound-agent"),
            patch.object(main, "find_elevenlabs_phone_number", return_value=None),
            patch.object(main, "import_elevenlabs_phone_number", return_value="new-phone-id"),
            patch.object(main, "assign_elevenlabs_phone_number_to_inbound_agent", return_value=False) as assign,
            patch.object(main, "delete_elevenlabs_phone_number", return_value=True) as delete,
        ):
            result = main.prepare_elevenlabs_phone_number_for_business("+12025550112", "Test line")

        self.assertIsNone(result)
        assign.assert_called_once_with("new-phone-id")
        delete.assert_called_once_with("new-phone-id")

    def test_existing_import_must_be_assigned_but_not_deleted_on_failure(self):
        with (
            patch.object(main, "elevenlabs_agent_id_inbound", "inbound-agent"),
            patch.object(main, "find_elevenlabs_phone_number", return_value={"phone_number_id": "existing-phone-id", "assigned_agent": {"agent_id": "other-agent"}}),
            patch.object(main, "import_elevenlabs_phone_number") as import_number,
            patch.object(main, "assign_elevenlabs_phone_number_to_inbound_agent", return_value=False),
            patch.object(main, "delete_elevenlabs_phone_number") as delete,
        ):
            result = main.prepare_elevenlabs_phone_number_for_business("+12025550112", "Test line")

        self.assertIsNone(result)
        import_number.assert_not_called()
        delete.assert_not_called()


class TwilioPurchaseTests(unittest.TestCase):
    def test_database_failure_releases_newly_purchased_number(self):
        purchase_response = Mock(ok=True)
        purchase_response.json.return_value = {"sid": "new-sid", "phone_number": "+12025550112"}
        with (
            patch.object(main, "twilio_account_sid", "account-sid"),
            patch.object(main, "get_twilio_auth_tuple", return_value=("account-sid", "token")),
            patch.object(main, "get_business_number_purchase_count", return_value=0),
            patch.object(main, "get_system_number_purchase_limit", return_value=3),
            patch.object(main.requests, "post", return_value=purchase_response),
            patch.object(main, "save_purchased_number_record", side_effect=RuntimeError("database unavailable")),
            patch.object(main, "release_twilio_number_by_sid", return_value=True) as release,
        ):
            with self.assertRaises(RuntimeError):
                main.purchase_specific_twilio_number_for_business({"id": 7, "name": "Example"}, "+12025550112")

        release.assert_called_once_with("new-sid")


class DirectLineClaimTests(unittest.IsolatedAsyncioTestCase):
    async def test_first_direct_line_activates_without_forwarding_entry(self):
        business = {"id": 7, "name": "Example", "twilio_number": None, "forwarding_config": {"numbers": []}}
        new_number = "+12025550112"
        with ExitStack() as stack:
            stack.enter_context(patch.object(main, "business_owner_id", return_value="owner"))
            stack.enter_context(patch.object(main, "get_business_record_for_user", return_value=business))
            stack.enter_context(patch.object(main, "get_active_purchased_number_for_business", return_value=None))
            stack.enter_context(patch.object(main, "purchase_specific_twilio_number_for_business", return_value=(business, {"phone_number": new_number, "sid": "new-sid"}, {"id": "pending-row"})))
            prepare = stack.enter_context(patch.object(main, "prepare_elevenlabs_phone_number_for_business", return_value="new-phone-id"))
            save = stack.enter_context(patch.object(main, "save_purchased_number_record", return_value={"id": "new-row"}))
            stack.enter_context(patch.object(main, "deactivate_other_purchased_numbers"))
            delete = stack.enter_context(patch.object(main, "delete_elevenlabs_phone_number"))
            stack.enter_context(patch.object(main, "hydrate_business_with_purchased_number_data", return_value={**business, "twilio_number": new_number, "twilio_number_status": "active"}))
            stack.enter_context(patch.object(main, "push_live_event"))
            stack.enter_context(patch.object(main, "get_business_number_purchase_count", return_value=1))
            stack.enter_context(patch.object(main, "get_system_number_purchase_limit", return_value=3))

            result = await main.claim_business_forwarding_number(
                SimpleNamespace(phone_number=new_number, label="Direct line"), current_user={"id": "owner"}
            )

        prepare.assert_called_once_with(new_number, "Direct line")
        self.assertEqual(save.call_args.args[1], new_number)
        self.assertTrue(result["provisioned"])
        self.assertEqual(result["twilio_number"], new_number)
        delete.assert_not_called()

    async def test_replacement_activates_new_number_not_previous_line(self):
        business = {"id": 7, "name": "Example", "twilio_number": "+12025550111"}
        old_row = {"id": "old-row", "is_active": True, "elevenlabs_phone_number_id": "old-phone-id"}
        new_number = "+12025550112"
        with ExitStack() as stack:
            stack.enter_context(patch.object(main, "business_owner_id", return_value="owner"))
            stack.enter_context(patch.object(main, "get_business_record_for_user", return_value=business))
            stack.enter_context(patch.object(main, "get_active_purchased_number_for_business", return_value=old_row))
            stack.enter_context(patch.object(main, "purchase_specific_twilio_number_for_business", return_value=(business, {"phone_number": new_number, "sid": "new-sid"}, {"id": "pending-row"})))
            prepare = stack.enter_context(patch.object(main, "prepare_elevenlabs_phone_number_for_business", return_value="new-phone-id"))
            save = stack.enter_context(patch.object(main, "save_purchased_number_record", return_value={"id": "new-row"}))
            deactivate = stack.enter_context(patch.object(main, "deactivate_other_purchased_numbers"))
            delete = stack.enter_context(patch.object(main, "delete_elevenlabs_phone_number", return_value=True))
            stack.enter_context(patch.object(main, "hydrate_business_with_purchased_number_data", return_value={**business, "twilio_number": new_number, "twilio_number_status": "active"}))
            stack.enter_context(patch.object(main, "push_live_event"))
            stack.enter_context(patch.object(main, "get_business_number_purchase_count", return_value=2))
            stack.enter_context(patch.object(main, "get_system_number_purchase_limit", return_value=3))

            result = await main.claim_business_forwarding_number(
                SimpleNamespace(phone_number=new_number, label="Direct line"), current_user={"id": "owner"}
            )

        prepare.assert_called_once_with(new_number, "Direct line")
        self.assertEqual(save.call_args.args[1], new_number)
        self.assertEqual(save.call_args.args[2]["twilio_incoming_phone_number_sid"], "new-sid")
        deactivate.assert_called_once_with(7, "new-row", kind="assigned_line")
        delete.assert_called_once_with("old-phone-id")
        self.assertEqual(result["twilio_number"], new_number)
        self.assertTrue(result["provisioned"])
        self.assertEqual(result["quality_check_status"], "not_run")

    async def test_failed_assignment_releases_new_number_and_preserves_old_line(self):
        business = {"id": 7, "name": "Example", "twilio_number": "+12025550111"}
        new_number = "+12025550112"
        with ExitStack() as stack:
            stack.enter_context(patch.object(main, "business_owner_id", return_value="owner"))
            stack.enter_context(patch.object(main, "get_business_record_for_user", return_value=business))
            stack.enter_context(patch.object(main, "get_active_purchased_number_for_business", return_value={"id": "old-row", "is_active": True, "elevenlabs_phone_number_id": "old-phone-id"}))
            stack.enter_context(patch.object(main, "purchase_specific_twilio_number_for_business", return_value=(business, {"phone_number": new_number, "sid": "new-sid"}, {"id": "pending-row"})))
            stack.enter_context(patch.object(main, "prepare_elevenlabs_phone_number_for_business", return_value=None))
            release = stack.enter_context(patch.object(main, "release_twilio_number_by_sid", return_value=True))
            save = stack.enter_context(patch.object(main, "save_purchased_number_record", return_value={"id": "pending-row"}))
            deactivate = stack.enter_context(patch.object(main, "deactivate_other_purchased_numbers"))
            delete = stack.enter_context(patch.object(main, "delete_elevenlabs_phone_number"))

            with self.assertRaises(HTTPException) as caught:
                await main.claim_business_forwarding_number(
                    SimpleNamespace(phone_number=new_number, label="Direct line"), current_user={"id": "owner"}
                )

        self.assertEqual(caught.exception.status_code, 502)
        release.assert_called_once_with("new-sid")
        self.assertEqual(save.call_args.args[1], new_number)
        self.assertEqual(save.call_args.args[2]["status"], "released")
        deactivate.assert_not_called()
        delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
