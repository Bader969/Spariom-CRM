import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { CustomerForm, buildCustomerPayload, type CustomerFormValues } from "@/components/CustomerForm";

export const Route = createFileRoute("/_app/kunden/$id/bearbeiten")({
  component: EditCustomer,
});

function EditCustomer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-edit", id],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Wird geladen…</div>;
  if (!customer) return <div className="p-6 text-muted-foreground">Kunde nicht gefunden</div>;

  const initial: CustomerFormValues = {
    salutation: (customer as any).salutation ?? "",
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    birthdate: (customer as any).birthdate ?? "",
    phone: (customer as any).phone ?? "",
    email: (customer as any).email ?? "",
    street: (customer as any).street ?? "",
    zip: (customer as any).zip ?? "",
    city: (customer as any).city ?? "",
    assigned_to: (customer as any).assigned_to ?? "",
    team_id: (customer as any).team_id ?? "",
    recorded_by: (customer as any).recorded_by ?? "",
    advisor_id: (customer as any).advisor_id ?? "",
    lead_source: (customer as any).lead_source ?? "",
    lead_source_detail: (customer as any).lead_source_detail ?? "",
    notes: (customer as any).notes ?? "",
    referred_by_customer_id: (customer as any).referred_by_customer_id ?? "",
    referral_bonus_amount: (customer as any).referral_bonus_amount != null ? String((customer as any).referral_bonus_amount) : "",
    referral_status: (customer as any).referral_status ?? "",
    referral_paid_at: (customer as any).referral_paid_at ?? "",
    referral_notes: (customer as any).referral_notes ?? "",
    personality_type: (customer as any).personality_type ?? "",
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/kunden/$id" params={{ id }} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunde bearbeiten</h1>
          <p className="text-sm text-muted-foreground">{customer.first_name} {customer.last_name}</p>
        </div>
      </div>

      <CustomerForm
        initial={initial}
        submitting={submitting}
        submitLabel="Änderungen speichern"
        onSubmit={async (f) => {
          if (!user) return;
          setSubmitting(true);
          const { error } = await supabase
            .from("customers")
            .update(buildCustomerPayload(f, user.id) as any)
            .eq("id", id);
          setSubmitting(false);
          if (error) {
            toast.error("Speichern fehlgeschlagen", { description: error.message });
            return;
          }
          toast.success("Kunde aktualisiert");
          navigate({ to: "/kunden/$id", params: { id } });
        }}
      />
    </div>
  );
}
