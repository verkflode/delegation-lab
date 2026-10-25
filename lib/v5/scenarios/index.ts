// The playable scenarios. A scenario is listed here once all four rounds have content for it.
import type { ScenarioDomain } from "../../types";
import type { V5Scenario } from "../scenario";
import { INVOICE } from "./invoice";

export const SCENARIOS: Record<ScenarioDomain, V5Scenario> = {
  invoice_processing: INVOICE,
};
