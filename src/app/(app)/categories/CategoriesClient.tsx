"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory, deleteRule, saveCategory, saveRule } from "./actions";
import type { Category, MerchantRule } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { Plus, Trash2 } from "@/components/ui/icons";

export function CategoriesClient({ categories, rules }: { categories: Category[]; rules: MerchantRule[] }) {
  const router = useRouter();
  const [newCat, setNewCat] = useState("");
  const [newRule, setNewRule] = useState({ keyword: "", suggested_category_id: "" });
  const [pending, start] = useTransition();
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Categories</h2>
        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            start(async () => {
              await saveCategory({ name: newCat.trim() });
              setNewCat("");
              router.refresh();
            });
          }}
        >
          <input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn-primary text-sm">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              cat={c}
              onSave={async (name) => {
                await saveCategory({ id: c.id, name });
                router.refresh();
              }}
              onDelete={async () => {
                if (confirm(`Delete "${c.name}"?`)) {
                  await deleteCategory(c.id);
                  router.refresh();
                }
              }}
            />
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Merchant rules</h2>
        <p className="text-xs text-slate-500 mb-3">
          When a merchant name contains the keyword, we'll auto-suggest the category.
        </p>
        <form
          className="grid grid-cols-3 gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newRule.keyword.trim()) return;
            start(async () => {
              await saveRule({
                keyword: newRule.keyword.trim(),
                suggested_category_id: newRule.suggested_category_id || null
              });
              setNewRule({ keyword: "", suggested_category_id: "" });
              router.refresh();
            });
          }}
        >
          <input className="input col-span-1" placeholder="keyword" value={newRule.keyword} onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} />
          <select className="input col-span-1" value={newRule.suggested_category_id} onChange={(e) => setNewRule({ ...newRule, suggested_category_id: e.target.value })}>
            <option value="">— Category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn-primary text-sm">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        <div className="overflow-y-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left">Keyword</th>
                <th className="table-cell text-left">Category</th>
                <th className="table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cat = r.suggested_category_id ? catById.get(r.suggested_category_id) : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="table-cell font-medium">{r.keyword}</td>
                    <td className="table-cell">
                      {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        className="text-brand-danger text-xs inline-flex items-center gap-1 hover:underline"
                        onClick={() => {
                          if (confirm("Delete this rule?"))
                            start(async () => {
                              await deleteRule(r.id);
                              router.refresh();
                            });
                        }}
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr><td className="table-cell text-slate-500 text-center" colSpan={3}>No rules yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ cat, onSave, onDelete }: { cat: Category; onSave: (name: string) => Promise<void>; onDelete: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between py-2">
      {editing ? (
        <input className="input mr-2" value={name} onChange={(e) => setName(e.target.value)} />
      ) : (
        <span>{cat.name}</span>
      )}
      <div className="flex gap-3 text-xs">
        {editing ? (
          <>
            <button className="text-brand-green font-medium hover:underline" onClick={() => start(async () => { await onSave(name); setEditing(false); })} disabled={pending}>Save</button>
            <button className="text-slate-500 hover:underline" onClick={() => { setName(cat.name); setEditing(false); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="text-slate-600 hover:underline" onClick={() => setEditing(true)}>Edit</button>
            <button className="text-brand-danger hover:underline" onClick={() => start(() => onDelete())} disabled={pending}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}
