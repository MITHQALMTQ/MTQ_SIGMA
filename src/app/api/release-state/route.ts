// GET /api/release-state
//
// Read-only exposure of the Task 12 §6 release-control state machine
// (src/lib/mtq/release-controls.ts) plus the Task 12 §5 address-book
// validation summary. This route GRANTS NOTHING — it publishes the exact
// control states and validation findings so an independent reviewer can see
// the fail-closed posture. The enforcement points are in the execution paths
// (keeper guard, release-controls assertions), not in this response.

import { NextResponse } from "next/server";
import {
  getReleaseState,
  describeAction,
  ACTION_IDS,
  type ActionId,
} from "@/lib/mtq/release-controls";
import { validateAddressBook } from "@/lib/mtq/address-book-validation";

export const dynamic = "force-dynamic";

export function GET() {
  const release = getReleaseState();
  const actions = ACTION_IDS.map((a: ActionId) => describeAction(a));
  const addressBook = validateAddressBook();

  return NextResponse.json({
    posture: release.posture,
    overallStatus: release.overallStatus,
    releaseNote:
      "Committed default: every control NOT_GRANTED, every chain-facing action DENIED (fail-closed). " +
      "Grants exist only in an owner-authored authorization file outside this repository " +
      "(RELEASE_AUTHORIZATIONS_FILE). No build, test, audit report, user session, or available " +
      "endpoint changes any of these states.",
    controls: release.controls,
    grantedCount: release.grantedCount,
    actions,
    addressBookValidation: {
      summary: addressBook.summary,
      findings: addressBook.findings,
      classifications: addressBook.classifications,
    },
  });
}
