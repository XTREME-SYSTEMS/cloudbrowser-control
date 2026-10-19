import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ResultSection from "@/components/heir-search/ResultSection";
import ClickableEntity from "@/components/heir-search/ClickableEntity";
import {
  Users, Phone, Mail, MapPin, Search, AlertCircle, CheckCircle, Clock,
  Database, Loader2, FileText, GitBranch, Gavel, UserX, UserCheck, Crown,
  Dna, Globe2, Landmark, Newspaper, ChevronDown, ChevronRight, Zap, Calendar,
} from "lucide-react";
import { downloadHeirPDF } from "@/lib/heirPDF";

export default function HeirSearchResults({
  result,
  setResult,
  deepSearch,
  searchingSection = null,
  onDeleteSection = undefined,
  onDeepSearchSection = undefined,
}) {
  const [expandedHeir, setExpandedHeir] = useState(null);
  const [tracingHeir, setTracingHeir] = useState(null);

  const ConfidenceBar = ({ score }) => (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#c9a961] rounded-full" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-500 w-7 text-right">{score}%</span>
    </div>
  );

  const priorityColor = (p) =>
    p === "primary" ? "text-[#0a1f3c]" : p === "secondary" ? "text-[#c9a961]" : "text-gray-500";

  const traceHeir = async (heirIndex) => {
    const heir = result.identified_heirs[heirIndex];
    if (!heir || !heir.name) return;
    setTracingHeir(heirIndex);
    try {
      const response = await base44.functions.invoke("runSkipTraceFallback", {
        owner_name: heir.name,
        deep_search: true,
      });
      const data = response.data || response;
      if (data && !data.error) {
        const updatedHeirs = [...result.identified_heirs];
        updatedHeirs[heirIndex] = {
          ...heir,
          phone_numbers: data.phone_numbers || heir.phone_numbers || [],
          emails: data.emails || heir.emails || [],
          address: data.addresses?.[0]?.address || heir.address || "",
          social_profiles: data.social_profiles || heir.social_profiles || [],
          confidence: Math.max(heir.confidence || 0, data.confidence_score || 0),
          notes: data.found_owner_name ? `Traced: ${data.found_owner_name}` : heir.notes,
        };
        setResult({ ...result, identified_heirs: updatedHeirs });
        setExpandedHeir(heirIndex);
      }
    } catch (e) {
      console.error("Heir trace failed:", e);
    } finally {
      setTracingHeir(null);
    }
  };

  const hasData = (obj) => obj && Object.keys(obj).length > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#0a1f3c] flex items-center gap-2">
            {result.status === "found" ? <CheckCircle className="w-5 h-5 text-green-500" />
             : result.status === "partial" ? <AlertCircle className="w-5 h-5 text-amber-500" />
             : <AlertCircle className="w-5 h-5 text-red-500" />}
            Heir Search Results
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {result.deceased_confirmed ? "Deceased identity confirmed" : "Deceased identity unconfirmed"}
            {" — "}{result.living_heir_count} living heirs found — Confidence: {result.confidence_score}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={result.status === "found" ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>
            {result.status.toUpperCase()}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => downloadHeirPDF(result)}
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
            <FileText className="w-3.5 h-3.5 mr-1" />PDF
          </Button>
        </div>
      </div>

      {/* Google Sheets Export Status */}
      {result.sheet_export && (
        <div className="p-4 rounded-xl border border-[#c9a961]/30 bg-[#c9a961]/5 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-slate-900">Exported to Google Sheets</p>
            <p className="text-xs text-slate-600">
              {result.sheet_export.exported} heir{result.sheet_export.exported !== 1 ? "s" : ""} appended to
              the "{result.sheet_export.sheet}" tab — {result.sheet_export.updated_range}
            </p>
          </div>
        </div>
      )}

      {/* Deceased Details */}
      {hasData(result.deceased_details) && (
        <ResultSection
          title="Deceased Person Confirmation"
          icon={UserX}
          sectionKey="deceased_details"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><span className="text-slate-500">Full Name:</span> <ClickableEntity>{result.deceased_details.full_name}</ClickableEntity></div>
            <div><span className="text-slate-500">Born:</span> {result.deceased_details.birth_date || "—"}</div>
            <div><span className="text-slate-500">Died:</span> {result.deceased_details.death_date || "—"}</div>
            <div><span className="text-slate-500">Last Residence:</span> <ClickableEntity type="address">{result.deceased_details.last_residence}</ClickableEntity></div>
            <div><span className="text-slate-500">Funeral Home:</span> {result.deceased_details.funeral_home || "—"}</div>
            <div><span className="text-slate-500">SSN Issued:</span> {result.deceased_details.ssn_state_issued || "—"}</div>
          </div>
          {result.deceased_details.obituary_text && (
            <div className="mt-3 p-3 rounded-md bg-slate-50">
              <p className="text-xs font-medium text-slate-500 mb-1">Obituary Excerpt:</p>
              <p className="text-sm">{result.deceased_details.obituary_text.substring(0, 500)}...</p>
            </div>
          )}
        </ResultSection>
      )}

      {/* Family Tree */}
      {hasData(result.family_tree) && (
        <ResultSection
          title="Family Tree"
          icon={GitBranch}
          sectionKey="family_tree"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.family_tree.spouse && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Spouse</p>
                <p className="text-sm"><ClickableEntity>{result.family_tree.spouse}</ClickableEntity></p>
              </div>
            )}
            {result.family_tree.ex_spouses?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Ex-Spouse(s)</p>
                <p className="text-sm">{result.family_tree.ex_spouses.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.ex_spouses.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.children?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Children</p>
                <p className="text-sm">{result.family_tree.children.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.children.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.parents?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Parents</p>
                <p className="text-sm">{result.family_tree.parents.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.parents.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.siblings?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Siblings</p>
                <p className="text-sm">{result.family_tree.siblings.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.siblings.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.grandchildren?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Grandchildren</p>
                <p className="text-sm">{result.family_tree.grandchildren.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.grandchildren.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.nieces_nephews?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Nieces & Nephews</p>
                <p className="text-sm">{result.family_tree.nieces_nephews.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.nieces_nephews.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
            {result.family_tree.cousins?.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Cousins</p>
                <p className="text-sm">{result.family_tree.cousins.map((n, i) => <span key={i}><ClickableEntity>{n}</ClickableEntity>{i < result.family_tree.cousins.length - 1 ? ", " : ""}</span>)}</p>
              </div>
            )}
          </div>
        </ResultSection>
      )}

      {/* Probate Info */}
      {hasData(result.probate_info) && (
        <ResultSection
          title="Probate Court Records"
          icon={Gavel}
          sectionKey="probate_info"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><span className="text-slate-500">Court County:</span> {result.probate_info.court_county || "—"}</div>
            <div><span className="text-slate-500">Case Number:</span> {result.probate_info.case_number || "Not found"}</div>
            <div><span className="text-slate-500">Executor:</span> <ClickableEntity>{result.probate_info.executor_name}</ClickableEntity></div>
            <div><span className="text-slate-500">Attorney:</span> <ClickableEntity>{result.probate_info.attorney_name}</ClickableEntity></div>
            <div><span className="text-slate-500">Filing Date:</span> {result.probate_info.filing_date || "—"}</div>
            <div><span className="text-slate-500">Estate Value:</span> {result.probate_info.estate_value || "—"}</div>
            <div><span className="text-slate-500">Will Found:</span> {result.probate_info.will_found ? "Yes" : "No / Unknown"}</div>
          </div>
          {result.probate_info.will_details && (
            <div className="mt-2 p-2 rounded-md bg-slate-50">
              <p className="text-xs">{result.probate_info.will_details}</p>
            </div>
          )}
        </ResultSection>
      )}

      {/* Historical Records */}
      {hasData(result.historical) && (
        <ResultSection
          title="Historical Records"
          icon={Newspaper}
          sectionKey="historical"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          {result.historical.census_household_members?.length > 0 && (
            <div><span className="text-slate-500">Census Household:</span> {result.historical.census_household_members.map(m => `${m.name} (${m.relationship}, ${m.year})`).join(", ")}</div>
          )}
          {result.historical.draft_cards?.length > 0 && (
            <div><span className="text-slate-500">Draft Cards:</span> {result.historical.draft_cards.map(d => `${d.name} — Next of kin: ${d.next_of_kin}`).join("; ")}</div>
          )}
          {result.historical.immigration_records?.length > 0 && (
            <div><span className="text-slate-500">Immigration:</span> {result.historical.immigration_records.map(i => `${i.name} arrived ${i.arrival_date} at ${i.port}`).join("; ")}</div>
          )}
          {result.historical.additional_relatives_found?.length > 0 && (
            <div><span className="text-slate-500">Additional Relatives:</span> {result.historical.additional_relatives_found.map(r => `${r.name} (${r.relationship})`).join(", ")}</div>
          )}
        </ResultSection>
      )}

      {/* Vital Records */}
      {hasData(result.vital) && (
        <ResultSection
          title="Vital Records"
          icon={FileText}
          sectionKey="vital"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          {result.vital.birth_record?.parents && (
            <div><span className="text-slate-500">Birth — Parents:</span> {result.vital.birth_record.parents.join(", ")} {result.vital.birth_record.mothers_maiden_name ? `(mother's maiden: ${result.vital.birth_record.mothers_maiden_name})` : ""}</div>
          )}
          {result.vital.marriage_records?.length > 0 && (
            <div><span className="text-slate-500">Marriages:</span> {result.vital.marriage_records.map(m => `${m.spouse} (${m.date})`).join("; ")}</div>
          )}
          {result.vital.divorce_records?.length > 0 && (
            <div><span className="text-slate-500">Divorces:</span> {result.vital.divorce_records.map(d => `${d.ex_spouse} (${d.date})`).join("; ")}</div>
          )}
          {result.vital.additional_relatives?.length > 0 && (
            <div><span className="text-slate-500">Additional from Vital:</span> {result.vital.additional_relatives.join(", ")}</div>
          )}
        </ResultSection>
      )}

      {/* DNA */}
      {hasData(result.dna) && (
        <ResultSection
          title="DNA / Genetic Genealogy"
          icon={Dna}
          description="For identifying unknown or missing heirs through genetic matches"
          sectionKey="dna"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          <div><span className="text-slate-500">Unknown Heirs Likely:</span> {result.dna.unknown_heirs_likely ? "Yes" : "No"}</div>
          {result.dna.dna_matches_found?.length > 0 && (
            <div><span className="text-slate-500">DNA Matches:</span> {result.dna.dna_matches_found.map(m => `${m.match_name} (${m.relationship_estimate}, ${m.shared_cm}cM)`).join(", ")}</div>
          )}
          {result.dna.recommended_dna_strategy && (
            <div className="p-2 rounded-md bg-slate-50"><span className="text-xs font-medium">Strategy:</span> <span className="text-xs">{result.dna.recommended_dna_strategy}</span></div>
          )}
        </ResultSection>
      )}

      {/* Property & Financial */}
      {hasData(result.property_financial) && (
        <ResultSection
          title="Property & Financial"
          icon={Landmark}
          sectionKey="property_financial"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          {result.property_financial.properties_owned?.length > 0 && (
            <div><span className="text-slate-500">Properties:</span> {result.property_financial.properties_owned.map((p, i) => <span key={i}><ClickableEntity type="address">{p.address}</ClickableEntity> ({p.value}){i < result.property_financial.properties_owned.length - 1 ? "; " : ""}</span>)}</div>
          )}
          {result.property_financial.business_ownership?.length > 0 && (
            <div><span className="text-slate-500">Businesses:</span> {result.property_financial.business_ownership.map(b => `${b.business_name} (${b.role})`).join("; ")}</div>
          )}
          {result.property_financial.estimated_estate_value && (
            <div><span className="text-slate-500">Est. Estate Value:</span> {result.property_financial.estimated_estate_value}</div>
          )}
        </ResultSection>
      )}

      {/* International */}
      {hasData(result.international) && (
        <ResultSection
          title="International Records"
          icon={Globe2}
          sectionKey="international"
          result={result}
          setResult={setResult}
          onDelete={onDeleteSection}
          onDeepSearch={onDeepSearchSection}
          searchingSection={searchingSection}
        >
          {result.international.international_heirs_found?.length > 0 && (
            <div><span className="text-slate-500">International Heirs:</span> {result.international.international_heirs_found.map(h => `${h.name} (${h.relationship}, ${h.country})`).join(", ")}</div>
          )}
          {result.international.emigration_records?.length > 0 && (
            <div><span className="text-slate-500">Emigration:</span> {result.international.emigration_records.join(", ")}</div>
          )}
        </ResultSection>
      )}

      {/* Deeper Tier sub-sections */}
      {deepSearch && hasData(result.unclaimed) && (
        <ResultSection title="Unclaimed Property & Estate Assets" icon={Landmark} sectionKey="unclaimed"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.unclaimed.unclaimed_assets?.length > 0 && (
            <p className="text-xs text-slate-500">{result.unclaimed.unclaimed_assets.map(a => `${a.type} (${a.source})`).join("; ")}</p>
          )}
          {result.unclaimed.total_unclaimed_value && <p className="text-xs">Total unclaimed: {result.unclaimed.total_unclaimed_value}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.cemetery_mortuary) && (
        <ResultSection title="Cemetery, Mortuary & Coroner" icon={UserX} sectionKey="cemetery_mortuary"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.cemetery_mortuary.cemetery_name && <p className="text-xs text-slate-500">Cemetery: {result.cemetery_mortuary.cemetery_name}</p>}
          {result.cemetery_mortuary.family_plot_members?.length > 0 && <p className="text-xs text-slate-500">Family plot: {result.cemetery_mortuary.family_plot_members.join(", ")}</p>}
          {result.cemetery_mortuary.next_of_kin_from_records && <p className="text-xs text-slate-500">Next of kin: {result.cemetery_mortuary.next_of_kin_from_records}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.immigration_nat) && (
        <ResultSection title="Immigration & Naturalization" icon={Globe2} sectionKey="immigration_nat"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.immigration_nat.family_from_immigration?.length > 0 && <p className="text-xs text-slate-500">Family: {result.immigration_nat.family_from_immigration.join(", ")}</p>}
          {result.immigration_nat.naturalization_records?.length > 0 && <p className="text-xs text-slate-500">Naturalized: {result.immigration_nat.naturalization_records.map(n => `${n.date} at ${n.court}`).join("; ")}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.patent_whois) && (
        <ResultSection title="Patent, Trademark & Domain WHOIS" icon={FileText} sectionKey="patent_whois"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.patent_whois.patents?.length > 0 && <p className="text-xs text-slate-500">Patents: {result.patent_whois.patents.map(p => p.title).join("; ")}</p>}
          {result.patent_whois.domain_registrations?.length > 0 && <p className="text-xs text-slate-500">Domains: {result.patent_whois.domain_registrations.map(d => d.domain).join(", ")}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.intl_genealogy) && (
        <ResultSection title="International Genealogy" icon={Globe2} sectionKey="intl_genealogy"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.intl_genealogy.country_of_origin && <p className="text-xs text-slate-500">Country of origin: {result.intl_genealogy.country_of_origin}</p>}
          {result.intl_genealogy.international_relatives?.length > 0 && <p className="text-xs text-slate-500">International relatives: {result.intl_genealogy.international_relatives.map(r => `${r.name} (${r.country})`).join(", ")}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.missing_persons) && (
        <ResultSection title="Missing Persons & Unknown Heir Databases" icon={UserX} sectionKey="missing_persons"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.missing_persons.missing_relatives?.length > 0 && <p className="text-xs text-slate-500">Missing: {result.missing_persons.missing_relatives.map(m => `${m.name} (${m.database})`).join(", ")}</p>}
          {result.missing_persons.deceased_relatives_confirmed?.length > 0 && <p className="text-xs text-slate-500">Confirmed deceased: {result.missing_persons.deceased_relatives_confirmed.map(d => d.name).join(", ")}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.professional_assoc) && (
        <ResultSection title="Professional & Trade Associations" icon={Users} sectionKey="professional_assoc"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.professional_assoc.association_members?.length > 0 && <p className="text-xs text-slate-500">Members: {result.professional_assoc.association_members.map(m => `${m.name} (${m.association})`).join("; ")}</p>}
        </ResultSection>
      )}
      {deepSearch && hasData(result.breach_verification) && (
        <ResultSection title="Breach Verification" icon={Database} sectionKey="breach_verification"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.breach_verification.verified_emails?.length > 0 && <p className="text-xs text-slate-500">Verified emails: {result.breach_verification.verified_emails.filter(e => e.verified).map(e => e.email).join(", ") || "None verified"}</p>}
        </ResultSection>
      )}

      {/* Extreme Deep sub-sections */}
      {result.extreme_deep && hasData(result.ucc_sec) && (
        <ResultSection title="UCC, SEC Litigation & Financial Enforcement" icon={Landmark} sectionKey="ucc_sec"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.ucc_sec.ucc_filings?.length > 0 && <p className="text-xs text-slate-500">UCC filings: {result.ucc_sec.ucc_filings.map(u => u.filer).join("; ")}</p>}
          {result.ucc_sec.sec_litigation?.length > 0 && <p className="text-xs text-slate-500">SEC actions: {result.ucc_sec.sec_litigation.join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.fec_lobby) && (
        <ResultSection title="FEC Donations & Lobbyist Registrations" icon={Landmark} sectionKey="fec_lobby"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.fec_lobby.contributions?.length > 0 && <p className="text-xs text-slate-500">Contributors: {result.fec_lobby.contributions.map(c => `${c.name} (${c.employer || 'employer unknown'})`).join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.username_correlation) && (
        <ResultSection title="Username Correlation & Forum/Gaming" icon={Search} sectionKey="username_correlation"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.username_correlation.profiles?.length > 0 && <p className="text-xs text-slate-500">Profiles: {result.username_correlation.profiles.map(p => `${p.platform}: ${p.username}`).join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.domain_archive) && (
        <ResultSection title="Domain WHOIS History & Web Archive" icon={Globe2} sectionKey="domain_archive"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.domain_archive.historical_whois?.length > 0 && <p className="text-xs text-slate-500">Historical WHOIS: {result.domain_archive.historical_whois.map(w => `${w.domain} (${w.date})`).join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.contact_verification) && (
        <ResultSection title="Contact Verification (SMTP & Phone Port)" icon={Mail} sectionKey="contact_verification"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.contact_verification.verified_emails?.length > 0 && <p className="text-xs text-slate-500">Verified emails: {result.contact_verification.verified_emails.filter(e => e.exists).map(e => e.email).join(", ") || "None confirmed"}</p>}
          {result.contact_verification.verified_phones?.length > 0 && <p className="text-xs text-slate-500">Verified phones: {result.contact_verification.verified_phones.map(p => `${p.number} (${p.line_type})`).join(", ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.crypto_assets) && (
        <ResultSection title="Cryptocurrency & Digital Assets" icon={Zap} sectionKey="crypto_assets"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.crypto_assets.wallets?.length > 0 && <p className="text-xs text-slate-500">Wallets: {result.crypto_assets.wallets.map(w => `${w.currency}: ${w.address}`).join("; ")}</p>}
          {result.crypto_assets.ens_domains?.length > 0 && <p className="text-xs text-slate-500">ENS domains: {result.crypto_assets.ens_domains.join(", ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.deed_chain) && (
        <ResultSection title="Property Deed Chain-of-Title" icon={Landmark} sectionKey="deed_chain"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.deed_chain.deed_chain?.length > 0 && <p className="text-xs text-slate-500">Transfers: {result.deed_chain.deed_chain.map(d => `${d.date}: ${d.grantor} to ${d.grantee}`).join("; ")}</p>}
          {result.deed_chain.related_owners?.length > 0 && <p className="text-xs text-slate-500">Related owners: {result.deed_chain.related_owners.join(", ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.permits_regulatory) && (
        <ResultSection title="Regulatory Permits & Violations" icon={FileText} sectionKey="permits_regulatory"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.permits_regulatory.permits?.length > 0 && <p className="text-xs text-slate-500">Permits: {result.permits_regulatory.permits.map(p => `${p.type} (${p.holder})`).join("; ")}</p>}
          {result.permits_regulatory.violations?.length > 0 && <p className="text-xs text-slate-500">Violations: {result.permits_regulatory.violations.map(v => v.type).join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.social_graph) && (
        <ResultSection title="Social Graph & Network Analysis" icon={Users} sectionKey="social_graph"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.social_graph.central_figures?.length > 0 && <p className="text-xs text-slate-500">Central figures: {result.social_graph.central_figures.join(", ")}</p>}
          {result.social_graph.hidden_connections?.length > 0 && <p className="text-xs text-slate-500">Hidden connections: {result.social_graph.hidden_connections.map(c => `${c.person_a} - ${c.person_b} (${c.connection})`).join("; ")}</p>}
        </ResultSection>
      )}
      {result.extreme_deep && hasData(result.business_network) && (
        <ResultSection title="Business Affiliation Network" icon={Landmark} sectionKey="business_network"
          result={result} setResult={setResult} onDelete={onDeleteSection} onDeepSearch={onDeepSearchSection} searchingSection={searchingSection}>
          {result.business_network.business_entities?.length > 0 && <p className="text-xs text-slate-500">Entities: {result.business_network.business_entities.map(b => `${b.business_name} (${b.role}, ${b.state})`).join("; ")}</p>}
        </ResultSection>
      )}

      {/* Identified Heirs */}
      {result.identified_heirs?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-serif text-base font-bold text-[#0a1f3c] flex items-center gap-2"><Crown className="w-4 h-4 text-[#c9a961]" />Identified Heirs ({result.identified_heirs.length})</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any name to search deeper — sorted by inheritance priority</p>
          </div>
          <div className="p-4 space-y-3">
            {[...result.identified_heirs]
              .sort((a, b) => a.relationship_degree - b.relationship_degree)
              .map((heir, i) => {
              const isOpen = expandedHeir === i;
              return (
              <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <button
                  type="button"
                  onClick={() => setExpandedHeir(isOpen ? null : i)}
                  className="flex items-center justify-between flex-wrap gap-2 w-full text-left hover:bg-slate-100 -m-1 p-1 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    {heir.is_living ? <UserCheck className="w-4 h-4 text-green-500" /> : <UserX className="w-4 h-4 text-red-400" />}
                    <span className="font-medium"><ClickableEntity>{heir.name}</ClickableEntity></span>
                    <Badge variant="outline" className={priorityColor(heir.inheritance_priority)}>
                      {heir.relationship}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {heir.inheritance_priority} heir
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConfidenceBar score={heir.confidence || 0} />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); traceHeir(i); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-[#0a1f3c]/20 text-[#0a1f3c] hover:bg-[#0a1f3c]/5 hover:border-[#c9a961]/40 transition-all cursor-pointer"
                      title={`Run full skip trace on ${heir.name}`}
                    >
                      {tracingHeir === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      {tracingHeir === i ? "Tracing..." : "Trace"}
                    </span>
                  </div>
                </button>
                {!heir.is_living && (
                  <p className="text-xs text-red-500">Likely deceased — descendants may inherit by representation</p>
                )}
                {heir.phone_numbers?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {heir.phone_numbers.map((p, j) => (
                      <Badge key={j} variant="outline" className="text-xs">
                        <Phone className="w-3 h-3 mr-1" />{p.number}
                        <span className="text-slate-500 ml-1">({p.confidence}%)</span>
                      </Badge>
                    ))}
                  </div>
                )}
                {heir.emails?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {heir.emails.map((e, j) => (
                      <Badge key={j} variant="outline" className="text-xs">
                        <Mail className="w-3 h-3 mr-1" />{e.email}
                        <span className="text-slate-500 ml-1">({e.confidence}%)</span>
                      </Badge>
                    ))}
                  </div>
                )}
                {heir.address && (
                  <p className="text-xs text-slate-500"><MapPin className="w-3 h-3 inline mr-1" /><ClickableEntity type="address">{heir.address}</ClickableEntity></p>
                )}
                {!heir.phone_numbers?.length && !heir.emails?.length && !heir.address && (
                  <p className="text-xs text-slate-500 italic">No contact info found yet — click "Trace" to run a full skip trace on this heir.</p>
                )}
                {isOpen && (
                  <div className="pt-2 mt-1 border-t space-y-2">
                    {heir.age_or_dob && (
                      <p className="text-xs"><Calendar className="w-3 h-3 inline mr-1 text-slate-500" /><span className="text-slate-500">Age / DOB:</span> {heir.age_or_dob}</p>
                    )}
                    {heir.relationship_degree != null && (
                      <p className="text-xs"><span className="text-slate-500">Kinship degree:</span> {heir.relationship_degree}</p>
                    )}
                    {heir.phone_numbers?.some(p => p.source) && (
                      <div className="text-xs">
                        <p className="text-slate-500 mb-1">Phone sources:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {heir.phone_numbers.filter(p => p.source).map((p, j) => (
                            <li key={j}>{p.number} — via {p.source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {heir.emails?.some(e => e.source) && (
                      <div className="text-xs">
                        <p className="text-slate-500 mb-1">Email sources:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {heir.emails.filter(e => e.source).map((e, j) => (
                            <li key={j}>{e.email} — via {e.source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {heir.social_profiles?.length > 0 && (
                      <div className="text-xs">
                        <p className="text-slate-500 mb-1">Social profiles:</p>
                        <div className="flex flex-wrap gap-2">
                          {heir.social_profiles.map((s, j) => (
                            <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors">
                              <Globe2 className="w-3 h-3" />{s.platform}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {heir.notes && (
                      <p className="text-xs text-slate-500 italic">{heir.notes}</p>
                    )}
                  </div>
                )}
              </div>
              );
              })}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2">
        <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" />{result.sources?.length || 0} sources</span>
        <span className="flex items-center gap-1"><Search className="w-3.5 h-3.5" />{result.methods?.length || 0} methods</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{(result.duration_ms / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}