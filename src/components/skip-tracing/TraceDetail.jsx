import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Section, Field, Chips, RecordCard, AuditObject, when,
} from "@/components/skip-tracing/traceDetailParts";
import {
  Search, Clock, ShieldCheck, ListChecks, Phone, Mail, MapPin, Globe,
  Users, Building, Database, FileText, Activity, Info,
} from "lucide-react";

const STATUS_TONE = {
  found: "text-emerald-500 border-emerald-500/40",
  partial: "text-amber-500 border-amber-500/40",
  failed: "text-red-500 border-red-500/40",
  searching: "text-blue-500 border-blue-500/40",
  pending: "text-muted-foreground border-border",
};

// Fields this view renders in their own section. Everything else the record
// carries falls through to "Other recorded fields", so a field added to the
// schema later still reaches the screen instead of being silently dropped.
const KNOWN_KEYS = new Set([
  "id", "created_date", "updated_date", "created_by_id",
  "target_property_address", "target_owner_name", "target_phone", "target_email", "target_company",
  "status", "confidence_score", "search_duration_ms", "batch_id", "notes",
  "authorization", "validation",
  "found_owner_name", "found_phone_numbers", "found_emails", "found_addresses",
  "found_social_profiles", "found_relatives",
  "property_data", "sources_checked", "methods_used", "search_results",
]);

const pct = (v) => (typeof v === "number" ? `${v}%` : null);

export default function TraceDetail({ trace }) {
  if (!trace) return null;

  const auth = trace.authorization || null;
  const validation = trace.validation || null;
  const violations = Array.isArray(validation?.violations) ? validation.violations : [];

  const extraKeys = Object.keys(trace).filter((k) => !KNOWN_KEYS.has(k));
  const extra = extraKeys.length
    ? extraKeys.reduce((acc, k) => {
        acc[k] = trace[k];
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-5">
      {/* Outcome */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={STATUS_TONE[trace.status] || "border-border"}>
          {(trace.status || "unknown").toUpperCase()}
        </Badge>
        {typeof trace.confidence_score === "number" && (
          <Badge variant="outline">{trace.confidence_score}% confidence</Badge>
        )}
        <Badge
          variant="outline"
          className={trace.found_owner_name ? "text-emerald-500 border-emerald-500/40" : "text-muted-foreground"}
        >
          {trace.found_owner_name ? `Owner: ${trace.found_owner_name}` : "Owner not identified"}
        </Badge>
      </div>

      {/* What was searched */}
      <Section icon={Search} title="What was searched">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Property address" value={trace.target_property_address} />
          <Field label="Owner name given" value={trace.target_owner_name} />
          <Field label="Phone given" value={trace.target_phone} mono />
          <Field label="Email given" value={trace.target_email} mono />
          <Field label="Company given" value={trace.target_company} />
          <Field label="Owner identified" value={trace.found_owner_name} />
        </div>
      </Section>

      {/* Run details */}
      <Section icon={Clock} title="How the run went">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Status" value={trace.status} />
          <Field label="Confidence" value={pct(trace.confidence_score)} />
          <Field
            label="Duration"
            value={trace.search_duration_ms ? `${(trace.search_duration_ms / 1000).toFixed(1)}s` : null}
          />
          <Field label="Batch" value={trace.batch_id} mono />
          <Field label="Started" value={when(trace.created_date)} />
          <Field label="Record id" value={trace.id} mono />
        </div>
      </Section>

      {/* Authorization */}
      {auth && (
        <Section icon={ShieldCheck} title="Authorization on record">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Permissible purpose" value={auth.permissible_purpose} />
            <Field label="Legal matter" value={auth.legal_matter} />
            <Field label="Case reference" value={auth.case_reference} mono />
            <Field label="Asserted by" value={auth.requested_by_email} />
          </div>
          <div className="pt-1">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Data categories</p>
            <Chips items={auth.data_categories} empty="None recorded" />
          </div>
        </Section>
      )}

      {/* Validation */}
      {validation && (
        <Section icon={ListChecks} title="Validation gate">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              label="Gate passed"
              value={validation.ok === true ? "Yes" : validation.ok === false ? "No" : null}
            />
            <Field label="Verified at" value={when(validation.verified_at)} />
            <Field label="Violations" value={violations.length} />
          </div>
          {validation.summary && <p className="text-sm">{validation.summary}</p>}
          {violations.length > 0 && (
            <div className="space-y-2 pt-1">
              {violations.map((v, i) => (
                <RecordCard key={`${v.rule}-${i}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{v.rule}</Badge>
                    {v.severity && (
                      <Badge
                        variant="outline"
                        className={v.severity === "blocking" ? "text-red-500 border-red-500/40" : "text-amber-500 border-amber-500/40"}
                      >
                        {v.severity}
                      </Badge>
                    )}
                    {v.field && <span className="text-[11px] text-muted-foreground">{v.field}</span>}
                  </div>
                  {v.message && <p className="mt-1.5 text-sm">{v.message}</p>}
                  {v.authority && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Authority: {v.authority}</p>
                  )}
                </RecordCard>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Phone numbers */}
      {trace.found_phone_numbers?.length > 0 && (
        <Section icon={Phone} title="Phone numbers" count={trace.found_phone_numbers.length}>
          <div className="space-y-2">
            {trace.found_phone_numbers.map((p, i) => (
              <RecordCard key={i}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_1fr_90px]">
                  <Field label="Number" value={p.number || p.display} mono href={p.number ? `tel:${p.number}` : null} />
                  <Field label="Type" value={p.type} />
                  <Field label="Source" value={p.source} />
                  <Field label="Confidence" value={pct(p.confidence)} />
                </div>
              </RecordCard>
            ))}
          </div>
        </Section>
      )}

      {/* Emails */}
      {trace.found_emails?.length > 0 && (
        <Section icon={Mail} title="Email addresses" count={trace.found_emails.length}>
          <div className="space-y-2">
            {trace.found_emails.map((e, i) => (
              <RecordCard key={i}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_1fr_90px]">
                  <Field label="Email" value={e.email} mono href={e.email ? `mailto:${e.email}` : null} />
                  <Field label="Verified" value={e.verified === true ? "Yes" : e.verified === false ? "No" : null} />
                  <Field label="Source" value={e.source} />
                  <Field label="Confidence" value={pct(e.confidence)} />
                </div>
              </RecordCard>
            ))}
          </div>
        </Section>
      )}

      {/* Addresses */}
      {trace.found_addresses?.length > 0 && (
        <Section icon={MapPin} title="Addresses" count={trace.found_addresses.length}>
          <div className="space-y-2">
            {trace.found_addresses.map((a, i) => (
              <RecordCard key={i}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_1fr_90px]">
                  <Field label="Address" value={a.address} />
                  <Field label="Type" value={a.type} />
                  <Field label="Source" value={a.source} />
                  <Field label="Confidence" value={pct(a.confidence)} />
                </div>
              </RecordCard>
            ))}
          </div>
        </Section>
      )}

      {/* Social profiles */}
      {trace.found_social_profiles?.length > 0 && (
        <Section icon={Globe} title="Social profiles" count={trace.found_social_profiles.length}>
          <div className="space-y-2">
            {trace.found_social_profiles.map((s, i) => (
              <RecordCard key={i}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[100px_1fr_90px]">
                  <Field label="Platform" value={s.platform} />
                  <Field label="Profile" value={s.url} href={s.url} />
                  <Field label="Confidence" value={pct(s.confidence)} />
                </div>
                {s.bio && <p className="mt-1.5 text-[11px] text-muted-foreground">{s.bio}</p>}
              </RecordCard>
            ))}
          </div>
        </Section>
      )}

      {/* Relatives */}
      {trace.found_relatives?.length > 0 && (
        <Section icon={Users} title="Relatives & associates" count={trace.found_relatives.length}>
          <div className="space-y-2">
            {trace.found_relatives.map((r, i) => (
              <RecordCard key={i}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Name" value={r.name} />
                  <Field label="Relationship" value={r.relationship} />
                  <Field label="Phone" value={r.phone} mono href={r.phone ? `tel:${r.phone}` : null} />
                </div>
              </RecordCard>
            ))}
          </div>
        </Section>
      )}

      {/* Property records */}
      {trace.property_data && Object.keys(trace.property_data).length > 0 && (
        <Section icon={Building} title="Property records">
          <AuditObject value={trace.property_data} />
        </Section>
      )}

      {/* Coverage */}
      <Section icon={Database} title="Coverage">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Sources checked ({trace.sources_checked?.length || 0})
          </p>
          <Chips items={trace.sources_checked} />
        </div>
        <div className="pt-1">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Methods used ({trace.methods_used?.length || 0})
          </p>
          <Chips items={trace.methods_used} />
        </div>
      </Section>

      {/* Notes */}
      {trace.notes && (
        <Section icon={FileText} title="Notes">
          <p className="whitespace-pre-wrap text-sm">{trace.notes}</p>
        </Section>
      )}

      {/* Raw search record */}
      {trace.search_results && Object.keys(trace.search_results).length > 0 && (
        <Section icon={Activity} title="Raw search record">
          <p className="text-[11px] text-muted-foreground">
            The per-method output kept for audit. Expand any entry to read the whole thing.
          </p>
          <AuditObject value={trace.search_results} />
        </Section>
      )}

      {/* Anything else the record holds */}
      {extra && (
        <Section icon={Info} title="Other recorded fields">
          <AuditObject value={extra} />
        </Section>
      )}
    </div>
  );
}