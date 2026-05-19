"use client";

import { useCallback, useEffect, useState } from "react";

type Manufacturer = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  _count?: { materials: number };
};
type Supplier = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  logoUrl: string | null;
  _count?: { pricing: number };
};
type Category = { id: string; name: string; slug: string };
type Material = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  grade: string | null;
  sheen: string | null;
  finish: string | null;
  thickness: string | null;
  category: { name: string };
  manufacturer: { name: string };
  _count?: { pricing: number };
};
type Pricing = {
  id: string;
  supplierId: string;
  supplier: { name: string };
  sheetPrice: number | null;
  cutPrice: number | null;
  cutUnit: string | null;
  unit: string | null;
  notes: string | null;
  isPreferred: boolean;
};

type Tab = "materials" | "manufacturers" | "suppliers";

export default function AdminMaterialsPage() {
  const [tab, setTab] = useState<Tab>("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pricing modal state
  const [pricingMaterial, setPricingMaterial] = useState<Material | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Add/edit forms
  const [addMfg, setAddMfg] = useState(false);
  const [addSup, setAddSup] = useState(false);
  const [addMat, setAddMat] = useState(false);
  const [mfgForm, setMfgForm] = useState({ name: "", website: "" });
  const [supForm, setSupForm] = useState({ name: "", city: "Las Vegas", state: "NV", website: "", phone: "" });
  const [matForm, setMatForm] = useState({ name: "", sku: "", categoryId: "", manufacturerId: "", grade: "", sheen: "", thickness: "", isPublic: true });
  const [saving, setSaving] = useState(false);

  // Edit state — one record at a time per resource. Original snapshot is kept
  // alongside the form so we can detect "no changes" and disable Save.
  type MatEditForm = { name: string; slug: string; sku: string; description: string; imageUrl: string; grade: string; sheen: string; finish: string; thickness: string; isPublic: boolean };
  type MfgEditForm = { name: string; slug: string; website: string; description: string; logoUrl: string };
  type SupEditForm = { name: string; slug: string; website: string; phone: string; address: string; city: string; state: string; description: string; logoUrl: string };
  const [editingMat, setEditingMat] = useState<{ id: string; original: MatEditForm } | null>(null);
  const [editMatForm, setEditMatForm] = useState<MatEditForm>({ name: "", slug: "", sku: "", description: "", imageUrl: "", grade: "", sheen: "", finish: "", thickness: "", isPublic: true });
  const [editMatError, setEditMatError] = useState<string | null>(null);
  const [editingMfg, setEditingMfg] = useState<{ id: string; original: MfgEditForm } | null>(null);
  const [editMfgForm, setEditMfgForm] = useState<MfgEditForm>({ name: "", slug: "", website: "", description: "", logoUrl: "" });
  const [editMfgError, setEditMfgError] = useState<string | null>(null);
  const [editingSup, setEditingSup] = useState<{ id: string; original: SupEditForm } | null>(null);
  const [editSupForm, setEditSupForm] = useState<SupEditForm>({ name: "", slug: "", website: "", phone: "", address: "", city: "", state: "", description: "", logoUrl: "" });
  const [editSupError, setEditSupError] = useState<string | null>(null);

  // Create-form errors — separate slots per section so an error in one Add
  // card doesn't bleed into another.
  const [createMatError, setCreateMatError] = useState<string | null>(null);
  const [createMfgError, setCreateMfgError] = useState<string | null>(null);
  const [createSupError, setCreateSupError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/materials");
    setLoading(false);
    if (!res.ok) { setError("Failed to load materials data."); return; }
    const data = (await res.json()) as { materials: Material[]; manufacturers: Manufacturer[]; suppliers: Supplier[]; categories: Category[] };
    setMaterials(data.materials ?? []);
    setManufacturers(data.manufacturers ?? []);
    setSuppliers(data.suppliers ?? []);
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openPricing(mat: Material) {
    setPricingMaterial(mat);
    setLoadingPricing(true);
    const res = await fetch(`/api/admin/materials/${mat.id}/pricing`);
    setLoadingPricing(false);
    if (res.ok) {
      const data = (await res.json()) as { pricing: Pricing[] };
      setPricing(data.pricing ?? []);
    }
  }

  async function saveMfg() {
    if (!mfgForm.name.trim()) return;
    setCreateMfgError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/materials/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mfgForm),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCreateMfgError(mapError(data.error, "manufacturer"));
        return;
      }
      setAddMfg(false);
      setMfgForm({ name: "", website: "" });
      await load();
    } catch {
      setCreateMfgError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSup() {
    if (!supForm.name.trim()) return;
    setCreateSupError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/materials/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supForm),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCreateSupError(mapError(data.error, "supplier"));
        return;
      }
      setAddSup(false);
      setSupForm({ name: "", city: "Las Vegas", state: "NV", website: "", phone: "" });
      await load();
    } catch {
      setCreateSupError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMat() {
    if (!matForm.name.trim() || !matForm.categoryId || !matForm.manufacturerId) return;
    setCreateMatError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matForm),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCreateMatError(mapError(data.error, "material"));
        return;
      }
      setAddMat(false);
      setMatForm({ name: "", sku: "", categoryId: "", manufacturerId: "", grade: "", sheen: "", thickness: "", isPublic: true });
      await load();
    } catch {
      setCreateMatError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMfg(id: string) {
    if (!confirm("Delete this manufacturer?")) return;
    try {
      const res = await fetch(`/api/admin/materials/manufacturers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(mapError(data.error, "manufacturer"));
        return;
      }
      await load();
    } catch {
      alert("Network error. Please try again.");
    }
  }

  async function deleteSup(id: string) {
    if (!confirm("Delete this supplier?")) return;
    try {
      const res = await fetch(`/api/admin/materials/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(mapError(data.error, "supplier"));
        return;
      }
      await load();
    } catch {
      alert("Network error. Please try again.");
    }
  }

  async function deleteMat(id: string) {
    if (!confirm("Delete this material?")) return;
    try {
      const res = await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(mapError(data.error, "material"));
        return;
      }
      await load();
    } catch {
      alert("Network error. Please try again.");
    }
  }

  function mapError(code: string | undefined, resource: "material" | "manufacturer" | "supplier"): string {
    switch (code) {
      case "NOT_FOUND": return `This ${resource} was deleted by someone else. Refresh the page.`;
      case "UNIQUE_CONSTRAINT": return `Another ${resource} already uses that slug or name. Try a different one.`;
      case "INVALID_NAME": return "The name must contain at least one letter or number.";
      case "IN_USE": return `This ${resource} is in use by other records and cannot be deleted. Remove the references first.`;
      case "NO_FIELDS": return "No changes to save.";
      case "INVALID_JSON": return "Something went wrong. Please try again.";
    }
    // POST handlers still return human-readable "X is required" strings.
    // Map them generically instead of leaking server text to the UI.
    if (typeof code === "string" && code.includes("required")) {
      return "Please fill in all required fields.";
    }
    return "Could not save. Please refresh the page and try again.";
  }

  function openEditMat(mat: Material) {
    const original: MatEditForm = {
      name: mat.name,
      slug: mat.slug,
      sku: mat.sku ?? "",
      description: mat.description ?? "",
      imageUrl: mat.imageUrl ?? "",
      grade: mat.grade ?? "",
      sheen: mat.sheen ?? "",
      finish: mat.finish ?? "",
      thickness: mat.thickness ?? "",
      isPublic: mat.isPublic,
    };
    setAddMat(false);
    setEditMatError(null);
    setEditingMat({ id: mat.id, original });
    setEditMatForm(original);
  }

  function cancelEditMat() {
    if (editingMat && JSON.stringify(editingMat.original) !== JSON.stringify(editMatForm)) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    setEditingMat(null);
    setEditMatError(null);
  }

  async function saveEditMat() {
    if (!editingMat) return;
    setEditMatError(null);
    setSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/admin/materials/${editingMat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editMatForm),
      });
    } catch {
      setSaving(false);
      setEditMatError("Network error. Please try again.");
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setEditMatError(mapError(data.error, "material"));
      return;
    }
    setEditingMat(null);
    await load();
  }

  function openEditMfg(mfg: Manufacturer) {
    const original: MfgEditForm = {
      name: mfg.name,
      slug: mfg.slug,
      website: mfg.website ?? "",
      description: mfg.description ?? "",
      logoUrl: mfg.logoUrl ?? "",
    };
    setAddMfg(false);
    setEditMfgError(null);
    setEditingMfg({ id: mfg.id, original });
    setEditMfgForm(original);
  }

  function cancelEditMfg() {
    if (editingMfg && JSON.stringify(editingMfg.original) !== JSON.stringify(editMfgForm)) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    setEditingMfg(null);
    setEditMfgError(null);
  }

  async function saveEditMfg() {
    if (!editingMfg) return;
    setEditMfgError(null);
    setSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/admin/materials/manufacturers/${editingMfg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editMfgForm),
      });
    } catch {
      setSaving(false);
      setEditMfgError("Network error. Please try again.");
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setEditMfgError(mapError(data.error, "manufacturer"));
      return;
    }
    setEditingMfg(null);
    await load();
  }

  function openEditSup(sup: Supplier) {
    const original: SupEditForm = {
      name: sup.name,
      slug: sup.slug,
      website: sup.website ?? "",
      phone: sup.phone ?? "",
      address: sup.address ?? "",
      city: sup.city ?? "",
      state: sup.state ?? "",
      description: sup.description ?? "",
      logoUrl: sup.logoUrl ?? "",
    };
    setAddSup(false);
    setEditSupError(null);
    setEditingSup({ id: sup.id, original });
    setEditSupForm(original);
  }

  function cancelEditSup() {
    if (editingSup && JSON.stringify(editingSup.original) !== JSON.stringify(editSupForm)) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    setEditingSup(null);
    setEditSupError(null);
  }

  async function saveEditSup() {
    if (!editingSup) return;
    setEditSupError(null);
    setSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/admin/materials/suppliers/${editingSup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSupForm),
      });
    } catch {
      setSaving(false);
      setEditSupError("Network error. Please try again.");
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setEditSupError(mapError(data.error, "supplier"));
      return;
    }
    setEditingSup(null);
    await load();
  }

  const matEditChanged = editingMat ? JSON.stringify(editingMat.original) !== JSON.stringify(editMatForm) : false;
  const mfgEditChanged = editingMfg ? JSON.stringify(editingMfg.original) !== JSON.stringify(editMfgForm) : false;
  const supEditChanged = editingSup ? JSON.stringify(editingSup.original) !== JSON.stringify(editSupForm) : false;

  const inputCls = "w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none focus:border-navy";
  const btnSave = "rounded-sm bg-navy px-4 py-2 font-ui text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50";
  const btnCancel = "rounded-sm border border-gray-warm px-4 py-2 font-ui text-sm text-charcoal hover:border-navy";
  const btnAdd = "inline-flex items-center gap-1 rounded-sm bg-red px-4 py-2 font-ui text-sm font-semibold text-white hover:opacity-90";
  const btnDel = "font-ui text-xs text-red hover:underline";

  return (
    <main className="bg-cream px-4 pb-16 pt-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mt-8 text-4xl text-charcoal">Materials</h1>
        <p className="mt-2 font-ui text-sm text-gray-mid">Manage material categories, manufacturers, suppliers, and pricing.</p>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-gray-warm">
          {(["materials", "manufacturers", "suppliers"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-5 py-2.5 font-ui text-sm font-semibold capitalize transition-colors ${tab === t ? "border-b-2 border-navy -mb-px text-navy" : "text-gray-mid hover:text-charcoal"}`}>
              {t}
            </button>
          ))}
        </div>

        {loading && <p className="mt-8 font-ui text-sm text-gray-mid">Loading...</p>}
        {error && <p className="mt-8 font-ui text-sm text-red">{error}</p>}

        {/* ── Materials Tab ── */}
        {!loading && tab === "materials" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-ui text-sm text-gray-mid">{materials.length} material{materials.length !== 1 ? "s" : ""}</p>
              <button type="button" onClick={() => { setAddMat(!addMat); setCreateMatError(null); }} className={btnAdd}>+ Add Material</button>
            </div>

            {editingMat && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">Edit Material</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={editMatForm.name} onChange={(e) => setEditMatForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="Slug *" value={editMatForm.slug} onChange={(e) => setEditMatForm((f) => ({ ...f, slug: e.target.value }))} />
                  <input className={inputCls} placeholder="SKU / code" value={editMatForm.sku} onChange={(e) => setEditMatForm((f) => ({ ...f, sku: e.target.value }))} />
                  <input className={inputCls} placeholder="Image URL" value={editMatForm.imageUrl} onChange={(e) => setEditMatForm((f) => ({ ...f, imageUrl: e.target.value }))} />
                  <input className={inputCls} placeholder="Grade" value={editMatForm.grade} onChange={(e) => setEditMatForm((f) => ({ ...f, grade: e.target.value }))} />
                  <input className={inputCls} placeholder='Thickness (e.g. 3/4")' value={editMatForm.thickness} onChange={(e) => setEditMatForm((f) => ({ ...f, thickness: e.target.value }))} />
                  <input className={inputCls} placeholder="Sheen" value={editMatForm.sheen} onChange={(e) => setEditMatForm((f) => ({ ...f, sheen: e.target.value }))} />
                  <input className={inputCls} placeholder="Finish" value={editMatForm.finish} onChange={(e) => setEditMatForm((f) => ({ ...f, finish: e.target.value }))} />
                  <textarea className={`${inputCls} sm:col-span-2`} placeholder="Description" rows={3} value={editMatForm.description} onChange={(e) => setEditMatForm((f) => ({ ...f, description: e.target.value }))} />
                  <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
                    <input type="checkbox" checked={editMatForm.isPublic} onChange={(e) => setEditMatForm((f) => ({ ...f, isPublic: e.target.checked }))} className="accent-navy" />
                    Show on public site
                  </label>
                </div>
                {editMatError && <p className="mt-3 font-ui text-sm text-red">{editMatError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveEditMat} disabled={saving || !editMatForm.name.trim() || !editMatForm.slug.trim() || !matEditChanged} className={btnSave}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={cancelEditMat} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            {addMat && !editingMat && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">New Material</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={matForm.name} onChange={(e) => setMatForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="SKU / code" value={matForm.sku} onChange={(e) => setMatForm((f) => ({ ...f, sku: e.target.value }))} />
                  <select className={inputCls} value={matForm.categoryId} onChange={(e) => setMatForm((f) => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">Category *</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className={inputCls} value={matForm.manufacturerId} onChange={(e) => setMatForm((f) => ({ ...f, manufacturerId: e.target.value }))}>
                    <option value="">Manufacturer *</option>
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input className={inputCls} placeholder="Grade" value={matForm.grade} onChange={(e) => setMatForm((f) => ({ ...f, grade: e.target.value }))} />
                  <input className={inputCls} placeholder='Thickness (e.g. 3/4")' value={matForm.thickness} onChange={(e) => setMatForm((f) => ({ ...f, thickness: e.target.value }))} />
                  <input className={inputCls} placeholder="Sheen" value={matForm.sheen} onChange={(e) => setMatForm((f) => ({ ...f, sheen: e.target.value }))} />
                  <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
                    <input type="checkbox" checked={matForm.isPublic} onChange={(e) => setMatForm((f) => ({ ...f, isPublic: e.target.checked }))} className="accent-navy" />
                    Show on public site
                  </label>
                </div>
                {createMatError && <p className="mt-3 font-ui text-sm text-red">{createMatError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveMat} disabled={saving} className={btnSave}>{saving ? "Saving..." : "Save Material"}</button>
                  <button type="button" onClick={() => { setAddMat(false); setCreateMatError(null); }} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {["Name", "Category", "Manufacturer", "Suppliers", "Public", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-ui text-xs font-semibold uppercase tracking-wider text-gray-mid">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat) => (
                    <tr key={mat.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-ui text-sm font-semibold text-charcoal">
                        {mat.name}
                        {mat.sku && <span className="ml-2 font-mono text-xs text-gray-mid">{mat.sku}</span>}
                      </td>
                      <td className="px-4 py-3 font-ui text-xs text-gray-mid">{mat.category.name}</td>
                      <td className="px-4 py-3 font-ui text-xs text-charcoal">{mat.manufacturer.name}</td>
                      <td className="px-4 py-3 font-ui text-xs text-gray-mid">{mat._count?.pricing ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 font-ui text-[10px] font-semibold ${mat.isPublic ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {mat.isPublic ? "Public" : "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openPricing(mat)} className="font-ui text-xs text-navy hover:underline">Pricing</button>
                          <button type="button" onClick={() => openEditMat(mat)} className="font-ui text-xs text-navy hover:underline">Edit</button>
                          <button type="button" onClick={() => deleteMat(mat.id)} className={btnDel}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center font-ui text-sm text-gray-mid">No materials yet. Add one above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Manufacturers Tab ── */}
        {!loading && tab === "manufacturers" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-ui text-sm text-gray-mid">{manufacturers.length} manufacturer{manufacturers.length !== 1 ? "s" : ""}</p>
              <button type="button" onClick={() => { setAddMfg(!addMfg); setCreateMfgError(null); }} className={btnAdd}>+ Add Manufacturer</button>
            </div>

            {editingMfg && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">Edit Manufacturer</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={editMfgForm.name} onChange={(e) => setEditMfgForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="Slug *" value={editMfgForm.slug} onChange={(e) => setEditMfgForm((f) => ({ ...f, slug: e.target.value }))} />
                  <input className={inputCls} placeholder="Website URL" value={editMfgForm.website} onChange={(e) => setEditMfgForm((f) => ({ ...f, website: e.target.value }))} />
                  <input className={inputCls} placeholder="Logo URL" value={editMfgForm.logoUrl} onChange={(e) => setEditMfgForm((f) => ({ ...f, logoUrl: e.target.value }))} />
                  <textarea className={`${inputCls} sm:col-span-2`} placeholder="Description" rows={3} value={editMfgForm.description} onChange={(e) => setEditMfgForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                {editMfgError && <p className="mt-3 font-ui text-sm text-red">{editMfgError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveEditMfg} disabled={saving || !editMfgForm.name.trim() || !editMfgForm.slug.trim() || !mfgEditChanged} className={btnSave}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={cancelEditMfg} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            {addMfg && !editingMfg && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">New Manufacturer</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={mfgForm.name} onChange={(e) => setMfgForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="Website URL" value={mfgForm.website} onChange={(e) => setMfgForm((f) => ({ ...f, website: e.target.value }))} />
                </div>
                {createMfgError && <p className="mt-3 font-ui text-sm text-red">{createMfgError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveMfg} disabled={saving} className={btnSave}>{saving ? "Saving..." : "Save"}</button>
                  <button type="button" onClick={() => { setAddMfg(false); setCreateMfgError(null); }} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {["Name", "Website", "Materials", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-ui text-xs font-semibold uppercase tracking-wider text-gray-mid">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manufacturers.map((mfg) => (
                    <tr key={mfg.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-ui text-sm font-semibold text-charcoal">{mfg.name}</td>
                      <td className="px-4 py-3">
                        {mfg.website ? (
                          <a href={mfg.website} target="_blank" rel="noopener noreferrer" className="font-ui text-xs text-navy hover:underline">{mfg.website} →</a>
                        ) : (
                          <span className="font-ui text-xs text-gray-mid">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-ui text-xs text-gray-mid">{mfg._count?.materials ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openEditMfg(mfg)} className="font-ui text-xs text-navy hover:underline">Edit</button>
                          <button type="button" onClick={() => deleteMfg(mfg.id)} className={btnDel}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {manufacturers.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center font-ui text-sm text-gray-mid">No manufacturers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Suppliers Tab ── */}
        {!loading && tab === "suppliers" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-ui text-sm text-gray-mid">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</p>
              <button type="button" onClick={() => { setAddSup(!addSup); setCreateSupError(null); }} className={btnAdd}>+ Add Supplier</button>
            </div>

            {editingSup && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">Edit Supplier</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={editSupForm.name} onChange={(e) => setEditSupForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="Slug *" value={editSupForm.slug} onChange={(e) => setEditSupForm((f) => ({ ...f, slug: e.target.value }))} />
                  <input className={inputCls} placeholder="Website URL" value={editSupForm.website} onChange={(e) => setEditSupForm((f) => ({ ...f, website: e.target.value }))} />
                  <input className={inputCls} placeholder="Phone" value={editSupForm.phone} onChange={(e) => setEditSupForm((f) => ({ ...f, phone: e.target.value }))} />
                  <input className={inputCls} placeholder="Address" value={editSupForm.address} onChange={(e) => setEditSupForm((f) => ({ ...f, address: e.target.value }))} />
                  <input className={inputCls} placeholder="City" value={editSupForm.city} onChange={(e) => setEditSupForm((f) => ({ ...f, city: e.target.value }))} />
                  <input className={inputCls} placeholder="State" value={editSupForm.state} onChange={(e) => setEditSupForm((f) => ({ ...f, state: e.target.value }))} />
                  <input className={inputCls} placeholder="Logo URL" value={editSupForm.logoUrl} onChange={(e) => setEditSupForm((f) => ({ ...f, logoUrl: e.target.value }))} />
                  <textarea className={`${inputCls} sm:col-span-2`} placeholder="Description" rows={3} value={editSupForm.description} onChange={(e) => setEditSupForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                {editSupError && <p className="mt-3 font-ui text-sm text-red">{editSupError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveEditSup} disabled={saving || !editSupForm.name.trim() || !editSupForm.slug.trim() || !supEditChanged} className={btnSave}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={cancelEditSup} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            {addSup && !editingSup && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 font-ui text-sm font-semibold text-charcoal">New Supplier</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Name *" value={supForm.name} onChange={(e) => setSupForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder="Website URL" value={supForm.website} onChange={(e) => setSupForm((f) => ({ ...f, website: e.target.value }))} />
                  <input className={inputCls} placeholder="City" value={supForm.city} onChange={(e) => setSupForm((f) => ({ ...f, city: e.target.value }))} />
                  <input className={inputCls} placeholder="State" value={supForm.state} onChange={(e) => setSupForm((f) => ({ ...f, state: e.target.value }))} />
                  <input className={inputCls} placeholder="Phone" value={supForm.phone} onChange={(e) => setSupForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                {createSupError && <p className="mt-3 font-ui text-sm text-red">{createSupError}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={saveSup} disabled={saving} className={btnSave}>{saving ? "Saving..." : "Save"}</button>
                  <button type="button" onClick={() => { setAddSup(false); setCreateSupError(null); }} className={btnCancel}>Cancel</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {["Name", "Location", "Website", "Materials", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-ui text-xs font-semibold uppercase tracking-wider text-gray-mid">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-ui text-sm font-semibold text-charcoal">{sup.name}</td>
                      <td className="px-4 py-3 font-ui text-xs text-gray-mid">{[sup.city, sup.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-3">
                        {sup.website ? (
                          <a href={sup.website} target="_blank" rel="noopener noreferrer" className="font-ui text-xs text-navy hover:underline truncate max-w-[180px] block">{sup.website} →</a>
                        ) : <span className="font-ui text-xs text-gray-mid">—</span>}
                      </td>
                      <td className="px-4 py-3 font-ui text-xs text-gray-mid">{sup._count?.pricing ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openEditSup(sup)} className="font-ui text-xs text-navy hover:underline">Edit</button>
                          <button type="button" onClick={() => deleteSup(sup.id)} className={btnDel}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center font-ui text-sm text-gray-mid">No suppliers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      {pricingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPricingMaterial(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-ui text-xs uppercase tracking-widest text-gray-mid">Pricing</p>
                <h3 className="mt-0.5 text-xl text-charcoal">{pricingMaterial.name}</h3>
              </div>
              <button type="button" onClick={() => setPricingMaterial(null)} className="text-gray-400 hover:text-charcoal text-lg leading-none">✕</button>
            </div>

            {loadingPricing ? (
              <p className="py-8 text-center font-ui text-sm text-gray-mid">Loading pricing...</p>
            ) : pricing.length === 0 ? (
              <p className="py-8 text-center font-ui text-sm text-gray-mid">No pricing data yet for this material.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      {["Supplier", "Sheet Price", "Cut Price", "Unit", "Preferred", "Updated"].map((h) => (
                        <th key={h} className="px-3 py-2 font-ui text-xs font-semibold uppercase tracking-wider text-gray-mid">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-ui text-sm font-semibold text-charcoal">{p.supplier.name}</td>
                        <td className="px-3 py-2 font-ui text-sm text-charcoal">{p.sheetPrice ? `$${p.sheetPrice.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 font-ui text-sm text-charcoal">{p.cutPrice ? `$${p.cutPrice.toFixed(2)}/${p.cutUnit ?? ""}` : "—"}</td>
                        <td className="px-3 py-2 font-ui text-xs text-gray-mid">{p.unit ?? "—"}</td>
                        <td className="px-3 py-2 text-center">{p.isPreferred ? <span className="text-amber-500">★</span> : ""}</td>
                        <td className="px-3 py-2 font-ui text-xs text-gray-mid">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
