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
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3"
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
          <input className="input" placeholder="keyword" value={newRule.keyword} onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} />
          <select className="input" value={newRule.suggested_category_id} onChange={(e) => setNewRule({ ...newRule, suggested_category_id: e.target.value })}>
            <option value="">— Category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn-primary text-sm w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        <div className="max-h-96 overflow-y-auto">
          {/* Desktop table */}
          <table className="hidden md:table min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
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
          {/* Mobile list */}
          <ul className="md:hidden divide-y divide-slate-100">
            {rules.length === 0 && (
              <li className="px-1 py-6 text-center text-sm text-slate-500">No rules yet.</li>
            )}
            {rules.map((r) => {
              const cat = r.suggested_category_id ? catById.get(r.suggested_category_id) : null;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-brand-navy truncate">{r.keyword}</span>
                    {cat ? (
                      <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </div>
                  <button
                    className="shrink-0 rounded-md p-2 text-brand-danger hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete ${r.keyword}`}
                    onClick={() => {
                      if (confirm("Delete this rule?"))
                        start(async () => {
                          await deleteRule(r.id);
                          router.refresh();
                        });
                    }}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
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
