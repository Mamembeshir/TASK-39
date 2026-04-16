import { describe, expect, it } from "vitest";
import { canManageTicketDisputes } from "@/features/tickets/utils/ticketRoles";

describe("canManageTicketDisputes", () => {
  it("returns true for dispute staff roles", () => {
    expect(canManageTicketDisputes(["administrator"])).toBe(true);
    expect(canManageTicketDisputes(["service_manager"])).toBe(true);
    expect(canManageTicketDisputes(["moderator"])).toBe(true);
  });

  it("returns false for customer-only access", () => {
    expect(canManageTicketDisputes(["customer"])).toBe(false);
    expect(canManageTicketDisputes([])).toBe(false);
  });
});
