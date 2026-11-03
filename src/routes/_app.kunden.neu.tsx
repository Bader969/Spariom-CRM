import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { CustomerForm, buildCustomerPayload, emptyCustomerForm } from "@/components/CustomerForm";

export const Route = createFileRoute("/_app/kunden/neu")({
  component: NewCustomer,
});

function NewCustomer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/kunden" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Neuer Kunde</h1>
          <p className="text-sm text-muted-foreground">Stammdaten, Zuweisung und Lead-Quelle erfassen.</p>
        </div>
      </div>

      <CustomerForm
        initial={emptyCustomerForm(user?.id)}
        submitting={submitting}
        submitLabel="Kunde anlegen"
        onSubmit={async (f) => {
          if (!user) return;
          setSubmitting(true);
          const { data, error } = await supabase
            .from("customers")
            .insert({ ...buildCustomerPayload(f, user.id), created_by: user.id } as any)
            .select("id")
            .single();
          setSubmitting(false);
          if (error) {
            toast.error("Kunde konnte nicht angelegt werden", { description: error.message });
            return;
          }
          toast.success("Kunde angelegt");
          navigate({ to: "/kunden/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
