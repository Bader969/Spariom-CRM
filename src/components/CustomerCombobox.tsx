import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CustomerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  zip: string | null;
  city: string | null;
};

export function CustomerCombobox({
  value,
  onChange,
  excludeIds = [],
  placeholder = "Kunde suchen…",
  allowClear = false,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: results } = useQuery({
    queryKey: ["customer-combobox-search", q],
    queryFn: async () => {
      let qb = supabase
        .from("customers")
        .select("id, first_name, last_name, zip, city")
        .order("last_name", { ascending: true })
        .limit(50);
      const term = q.trim();
      if (term) {
        qb = qb.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      const { data } = await qb;
      return (data ?? []) as CustomerRow[];
    },
  });

  const { data: selected } = useQuery({
    queryKey: ["customer-combobox-selected", value],
    enabled: !!value,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, first_name, last_name, zip, city")
        .eq("id", value!)
        .maybeSingle();
      return data as CustomerRow | null;
    },
  });

  const label = (c: CustomerRow | null | undefined) =>
    c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "— ohne Name —" : "";

  const filtered = (results ?? []).filter((c) => !excludeIds.includes(c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="truncate text-left">
            {value && selected ? label(selected) : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Name, E-Mail, Telefon…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Keine Treffer.</CommandEmpty>
            {allowClear && value && (
              <CommandGroup>
                <CommandItem onSelect={() => { onChange(null); setOpen(false); }}>
                  <span className="text-muted-foreground">— Auswahl entfernen —</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{label(c)}</span>
                    {(c.zip || c.city) && (
                      <span className="text-xs text-muted-foreground">{c.zip} {c.city}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
