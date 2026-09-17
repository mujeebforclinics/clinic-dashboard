"use client";

import Spinner from "@/components/Spinner";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ItemWithBatches = {
  id: string;
  item_name: string;
  category: string | null;
  unit: string | null;
  reorder_level: number;
  inventory_batches: { id: string; quantity: number; expiry_date: string | null; batch_number: string | null; received_date?: string | null }[];
};

export default function InventoryTab({ clinicId }: { clinicId: string }) {
  const [items, setItems] = useState<ItemWithBatches[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [saving, setSaving] = useState(false);

  const [stockingId, setStockingId] = useState<string | null>(null);
  const [batchQty, setBatchQty] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("inventory_items")
      .select("*, inventory_batches(id, quantity, expiry_date, batch_number, received_date)")
      .eq("clinic_id", clinicId)
      .order("item_name", { ascending: true });
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("inventory_items").insert({
      clinic_id: clinicId,
      item_name: itemName,
      category,
      unit,
      reorder_level: Number(reorderLevel) || 0,
    });
    setSaving(false);
    setItemName("");
    setCategory("");
    setUnit("");
    setShowItemForm(false);
    load();
  };

  const totalQty = (item: ItemWithBatches) =>
    (item.inventory_batches ?? []).reduce((s, b) => s + b.quantity, 0);

  const [usingId, setUsingId] = useState<string | null>(null);
  const [useQty, setUseQty] = useState("");
  const [useError, setUseError] = useState("");

  const useStock = async (item: ItemWithBatches) => {
    const qtyToUse = Number(useQty);
    if (!qtyToUse || qtyToUse <= 0) return;
    setUseError("");

    const available = totalQty(item);
    if (qtyToUse > available) {
      setUseError(`Only ${available} in stock.`);
      return;
    }

    // Deduct FIFO: oldest batches (by received date) get used up first
    const batches = [...(item.inventory_batches ?? [])].sort((a: any, b: any) =>
      (a.received_date ?? "").localeCompare(b.received_date ?? "")
    );
    let remaining = qtyToUse;
    for (const batch of batches as any[]) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      if (take <= 0) continue;
      await supabase
        .from("inventory_batches")
        .update({ quantity: batch.quantity - take })
        .eq("id", batch.id);
      remaining -= take;
    }

    await supabase.from("inventory_transactions").insert({
      clinic_id: clinicId,
      item_id: item.id,
      transaction_type: "stock_out",
      quantity: qtyToUse,
      reference_note: "Used in treatment",
    });

    setUsingId(null);
    setUseQty("");
    load();
  };

  const addStock = async (item: ItemWithBatches) => {
    if (!batchQty) return;
    const { data: batch } = await supabase
      .from("inventory_batches")
      .insert({
        clinic_id: clinicId,
        item_id: item.id,
        quantity: Number(batchQty),
        batch_number: batchNumber || null,
        expiry_date: expiryDate || null,
      })
      .select()
      .single();

    await supabase.from("inventory_transactions").insert({
      clinic_id: clinicId,
      item_id: item.id,
      batch_id: batch?.id,
      transaction_type: "stock_in",
      quantity: Number(batchQty),
      reference_note: "Manual stock-in",
    });

    setStockingId(null);
    setBatchQty("");
    setBatchNumber("");
    setExpiryDate("");
    load();
  };

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false;
    const days =
      (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  };

  return (
    <div className="lg:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="font-display text-xl font-semibold">Inventory</h2>
        <button
          className="btn-primary"
          onClick={() => setShowItemForm(!showItemForm)}
        >
          {showItemForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

      {showItemForm && (
        <form
          onSubmit={handleAddItem}
          className="card p-5 mb-5 grid grid-cols-2 gap-3 shrink-0"
        >
          <input
            className="input col-span-2"
            placeholder="Item name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className="input"
            placeholder="Unit (e.g. strip, box)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <input
            className="input col-span-2"
            type="number"
            placeholder="Reorder level (alert when stock falls below this)"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-primary col-span-2"
          >
            {saving ? (<><Spinner size={14} className="mr-1.5" />Saving</>) : "Save item"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line lg:flex-1 lg:min-h-0 overflow-y-auto">
        {items.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No inventory items yet. Add your first one above.
          </p>
        )}
        {items.map((item) => {
          const qty = totalQty(item);
          const low = qty <= item.reorder_level;
          const expiringBatches = (item.inventory_batches ?? []).filter((b) =>
            isExpiringSoon(b.expiry_date)
          );
          return (
            <div key={item.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {item.item_name}{" "}
                    {low && (
                      <span className="text-xs bg-clay/15 text-clay px-2 py-0.5 rounded-full ml-1">
                        Low stock
                      </span>
                    )}
                    {expiringBatches.length > 0 && (
                      <span className="text-xs bg-clay/10 text-clay px-2 py-0.5 rounded-full ml-1">
                        Expiring soon
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink/60">
                    {qty} {item.unit || "units"} in stock ·{" "}
                    {item.category || "Uncategorized"} · reorder at{" "}
                    {item.reorder_level}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost text-xs px-2 py-1"
                    onClick={() => {
                      setUsingId(usingId === item.id ? null : item.id);
                      setUseError("");
                    }}
                  >
                    - Use stock
                  </button>
                  <button
                    className="btn-ghost text-xs px-2 py-1"
                    onClick={() =>
                      setStockingId(stockingId === item.id ? null : item.id)
                    }
                  >
                    + Stock in
                  </button>
                </div>
              </div>

              {usingId === item.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="Quantity used"
                    value={useQty}
                    onChange={(e) => setUseQty(e.target.value)}
                  />
                  <button className="btn-primary whitespace-nowrap" onClick={() => useStock(item)}>
                    Confirm use
                  </button>
                </div>
              )}
              {useError && usingId === item.id && (
                <p className="text-xs text-clay mt-1">{useError}</p>
              )}

              {stockingId === item.id && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="Quantity"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Batch # (optional)"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                  />
                  <input
                    className="input"
                    type="date"
                    placeholder="Expiry date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                  <button
                    className="btn-primary col-span-3"
                    onClick={() => addStock(item)}
                  >
                    Add stock
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
