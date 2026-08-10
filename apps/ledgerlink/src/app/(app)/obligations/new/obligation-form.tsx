"use client";
import { useState } from "react";
import { createObligationAction } from "../../actions";
import { Card, CardBody } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea, CurrencyInput, Label } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/ui";
import { ArrowDownLeft, ArrowUpRight } from "@/components/ui/icons";
import type { Contact } from "@/lib/types";

type Dir = "owed_to_me" | "i_owe";
type Mode = "single" | "generate" | "manual";

export function ObligationForm({ contacts }: { contacts: Contact[] }) {
  const [direction, setDirection] = useState<Dir>("owed_to_me");
  const [mode, setMode] = useState<Mode>("generate");
  const [interestType, setInterestType] = useState("none");
  const [counterparty, setCounterparty] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createObligationAction} className="space-y-4">
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="schedule_mode" value={mode} />

      {/* Step 1 — who owes whom */}
      <Card>
        <CardBody className="space-y-3">
          <Label>Who owes whom?</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDirection("owed_to_me")}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                direction === "owed_to_me" ? "border-incoming bg-incoming-soft" : "border-line hover:bg-canvas",
              )}
            >
              <ArrowDownLeft className="h-5 w-5 text-incoming" />
              <span>
                <span className="block text-sm font-medium">Someone owes me</span>
                <span className="block text-xs text-subtle">A receivable — money coming in</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDirection("i_owe")}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                direction === "i_owe" ? "border-outgoing bg-outgoing-soft" : "border-line hover:bg-canvas",
              )}
            >
              <ArrowUpRight className="h-5 w-5 text-outgoing" />
              <span>
                <span className="block text-sm font-medium">I owe someone</span>
                <span className="block text-xs text-subtle">A payable — money going out</span>
              </span>
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Step 2 — parties & basics */}
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Obligation name" htmlFor="name">
            <Input id="name" name="name" required placeholder="e.g. UnionBank EasyCash" />
          </Field>
          <Field label={direction === "owed_to_me" ? "Who owes me (name)" : "Who I owe (name)"}>
            <Input
              name="counterparty_name"
              required
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={direction === "owed_to_me" ? "e.g. Mari Cel" : "e.g. UnionBank"}
            />
          </Field>
          <Field label="Link a contact (optional)">
            <Select
              name="contact_id"
              defaultValue=""
              onChange={(e) => {
                const c = contacts.find((x) => x.id === e.target.value);
                if (c && !counterparty) setCounterparty(c.name);
              }}
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select name="currency_code" defaultValue="PHP">
              <option value="PHP">PHP — Philippine peso</option>
              <option value="USD">USD — US dollar</option>
              <option value="SGD">SGD — Singapore dollar</option>
              <option value="EUR">EUR — Euro</option>
            </Select>
          </Field>
          <Field label="Original principal">
            <CurrencyInput name="principal" required />
          </Field>
          <Field label="Start date">
            <Input name="start_date" type="date" defaultValue={today} required />
          </Field>
        </CardBody>
      </Card>

      {/* Step 3 — schedule */}
      <Card>
        <CardBody className="space-y-3">
          <Label>Payment schedule</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              ["single", "One-time", "A single due amount"],
              ["generate", "Generate", "Build an installment plan"],
              ["manual", "Paste / import", "Enter the bank's real schedule"],
            ] as [Mode, string, string][]).map(([m, title, desc]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  mode === m ? "border-ink bg-canvas" : "border-line hover:bg-canvas",
                )}
              >
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-subtle">{desc}</span>
              </button>
            ))}
          </div>

          {mode === "generate" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Frequency">
                <Select name="frequency" defaultValue="monthly">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semiannual">Semi-annually</option>
                  <option value="annual">Annually</option>
                </Select>
              </Field>
              <Field label="Number of installments">
                <Input name="num_installments" type="number" min={1} defaultValue={12} />
              </Field>
              <Field label="Interest type">
                <Select name="interest_type" value={interestType} onChange={(e) => setInterestType(e.target.value)}>
                  <option value="none">No interest</option>
                  <option value="flat_factor">Flat / factor rate</option>
                  <option value="amortized">Amortized (reducing balance)</option>
                </Select>
              </Field>
              <Field
                label={interestType === "amortized" ? "Annual interest rate (%)" : "Monthly rate (%)"}
                hint={interestType === "none" ? "Not used for no-interest debts" : undefined}
              >
                <Input name="interest_rate" type="text" inputMode="decimal" placeholder="e.g. 21.23" disabled={interestType === "none"} />
              </Field>
            </div>
          )}

          {mode === "manual" && (
            <Field
              label="Paste schedule"
              hint="One installment per line: date, total[, principal, interest, fees]. Example: 2026-08-15, 23658.87, 9034.07, 14624.80"
            >
              <Textarea
                name="manual_schedule"
                rows={6}
                placeholder={"2026-08-15, 23658.87, 9034.07, 14624.80\n2026-09-15, 23658.87, 9180.20, 14478.67"}
                className="font-mono text-xs"
              />
              {/* keep a frequency present so the schema is satisfied */}
              <input type="hidden" name="frequency" value="monthly" />
            </Field>
          )}

          {mode === "single" && <input type="hidden" name="frequency" value="one_time" />}
        </CardBody>
      </Card>

      {/* Step 4 — fees & extras */}
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Processing fee">
            <CurrencyInput name="processing_fee" defaultValue="0" />
          </Field>
          <Field label="Other fees">
            <CurrencyInput name="other_fees" defaultValue="0" />
          </Field>
          <Field label="Grace period (days)">
            <Input name="grace_period_days" type="number" min={0} defaultValue={0} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea name="notes" rows={2} placeholder="Anything worth remembering about this debt." />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton pendingText="Creating…">Create obligation</SubmitButton>
      </div>
    </form>
  );
}
